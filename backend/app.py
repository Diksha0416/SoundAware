import os
import tempfile
import traceback
import numpy as np
from flask import Flask, request, jsonify
import importlib.util
from flask_cors import CORS
import subprocess
import shutil


def load_pred_module(project_root):
    pred_path = os.path.join(project_root, "contexts", "pred_with_audio.py")
    spec = importlib.util.spec_from_file_location("pred_with_audio", pred_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def create_app():
    app = Flask(__name__)
    # Allow configuring CORS origins via environment variable.
    # Default includes the Vercel app domain and common localhost origins used during development.
    env_origins = os.environ.get('CORS_ORIGINS')
    dev_allow_all = os.environ.get('DEV_ALLOW_ALL_ORIGINS') in ('1', 'true', 'True')
    if dev_allow_all:
        cors_origins = '*'
    else:
        if env_origins:
            cors_origins = [o.strip() for o in env_origins.split(',') if o.strip()]
        else:
            # include common localhost/Metro/Expo web origins used during development
            cors_origins = [
                'https://sound-aware.vercel.app',
                'http://localhost:19006',
                'http://127.0.0.1:19006',
                'http://localhost:19000',
                'http://localhost:3000',
                'http://127.0.0.1:5000',
                'http://localhost:8081',
                'http://localhost:8080',
            ]
    print(f"[startup] CORS origins: {cors_origins} (DEV_ALLOW_ALL_ORIGINS={dev_allow_all})")
    if cors_origins == '*':
        CORS(app)
    else:
        CORS(app, origins=cors_origins)

    project_root = os.path.dirname(os.path.abspath(__file__))

    # Load helper module that contains preprocessing and class names
    pred_mod = load_pred_module(project_root)
    audio_to_mel_image = getattr(pred_mod, "audio_to_mel_image")
    class_names = getattr(pred_mod, "class_names")

    # Try to reuse interpreter loaded by pred_with_audio.py if present
    interpreter = getattr(pred_mod, "interpreter", None)
    input_details = getattr(pred_mod, "input_details", None)
    output_details = getattr(pred_mod, "output_details", None)

    if interpreter is None:
        import tensorflow as tf
        model_path = os.path.join(project_root, "contexts", "model_int8.tflite")
        interpreter = tf.lite.Interpreter(model_path=model_path)
        interpreter.allocate_tensors()
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()

    # Optional API key enforcement
    API_KEY = os.environ.get("PRED_API_KEY")


    def quantize_input(image: np.ndarray, detail: dict):
        q = detail.get('quantization', (0.0, 0))
        scale, zero_point = q if q is not None else (0.0, 0)
        dtype = detail.get('dtype', None)

        if not scale or scale == 0:
            return image.astype(np.float32), {
                'mode': 'float', 'scale': scale, 'zero_point': zero_point, 'dtype': str(dtype)
            }

        qdata = np.round(image / scale) + zero_point
        qstr = str(dtype).lower() if dtype is not None else ''
        if 'uint8' in qstr:
            qdata = np.clip(qdata, 0, 255).astype(np.uint8)
        elif 'int8' in qstr:
            qdata = np.clip(qdata, -128, 127).astype(np.int8)
        else:
            qdata = qdata.astype(np.int32)

        return qdata, {'mode': 'quant', 'scale': float(scale), 'zero_point': int(zero_point), 'dtype': str(dtype)}


    def dequantize_output(out_tensor: np.ndarray, detail: dict):
        q = detail.get('quantization', (0.0, 0))
        scale, zero_point = q if q is not None else (0.0, 0)
        if not scale or scale == 0:
            return out_tensor.astype(np.float32), {'mode': 'float', 'scale': scale, 'zero_point': zero_point}
        return scale * (out_tensor.astype(np.float32) - zero_point), {'mode': 'dequant', 'scale': float(scale), 'zero_point': int(zero_point)}


    @app.route("/health")
    def health():
        return jsonify({"status": "ok"})


    @app.route("/predict", methods=["POST"])
    def predict():
        if API_KEY:
            key = request.headers.get("x-api-key")
            if key != API_KEY:
                return jsonify({"error": "missing or invalid API key"}), 401
        # debug info: log incoming request context
        try:
            print(f"[predict] method={request.method} remote_addr={request.remote_addr} origin={request.headers.get('Origin')} headers_x_api_key={request.headers.get('x-api-key')}")
        except Exception:
            pass

        # allow optional debug mode via query param or header
        debug_mode = str(request.args.get('debug', '')).lower() in ('1', 'true') or request.headers.get('X-Debug') == '1'

        if "file" not in request.files:
            return jsonify({"error": "no file provided"}), 400

        f = request.files["file"]
        if f.filename == "":
            return jsonify({"error": "empty filename"}), 400

        tmp = None
        try:
            tmpf = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(f.filename)[1] or ".wav")
            tmp = tmpf.name
            tmpf.close()
            f.save(tmp)

            try:
                print(f"[predict] upload filename={f.filename}")
            except Exception:
                pass

            # sanity-check saved file
            try:
                file_size = os.path.getsize(tmp)
            except Exception:
                file_size = -1

            if file_size <= 44:
                # WAV header is typically 44 bytes; treat smaller files as invalid
                return jsonify({"error": "uploaded file too small or empty", "path": tmp, "size": file_size}), 400

            # read a small header preview to aid debugging
            try:
                with open(tmp, 'rb') as fh:
                    header_preview = fh.read(128).hex()
            except Exception:
                header_preview = None

            print(f"[predict] saved upload -> {tmp} (size={file_size}) header_preview={header_preview}")

            # If header doesn't start with RIFF (52494646), try converting with ffmpeg.
            # Many mobile/web recordings use WebM/Opus or other containers which librosa may not decode directly.
            needs_conversion = True
            if header_preview and header_preview.startswith('52494646'):
                needs_conversion = False

            converted = None
            if needs_conversion:
                ffmpeg_path = shutil.which('ffmpeg')
                if ffmpeg_path:
                    tmp_wav = tmp + '.converted.wav'
                    cmd = [ffmpeg_path, '-y', '-i', tmp, '-ar', '16000', '-ac', '1', tmp_wav]
                    proc = subprocess.run(cmd, capture_output=True, text=True)
                    print(f"[predict] ffmpeg rc={proc.returncode} stdout={proc.stdout[:200]} stderr={proc.stderr[:200]}")
                    if proc.returncode == 0 and os.path.exists(tmp_wav):
                        converted = tmp_wav
                        # update tmp and header_preview for downstream
                        try:
                            with open(converted, 'rb') as fh:
                                header_preview = fh.read(128).hex()
                        except Exception:
                            pass
                    else:
                        # conversion failed: keep going to try original (librosa may still work), but log
                        print(f"[predict] ffmpeg conversion failed for {tmp}: rc={proc.returncode}")
                else:
                    print("[predict] ffmpeg not found on PATH; cannot convert non-WAV uploads")

            # prefer converted file if available
            use_path = converted if converted is not None else tmp

            # Load and preprocess audio -> mel image
            try:
                input_image = audio_to_mel_image(use_path)
            except Exception as e:
                print(f"[predict] audio_to_mel_image failed for {use_path}: {e}")
                # if we haven't tried conversion yet, and ffmpeg exists, try now
                if converted is None and shutil.which('ffmpeg'):
                    ffmpeg_path = shutil.which('ffmpeg')
                    tmp_wav = tmp + '.converted.wav'
                    cmd = [ffmpeg_path, '-y', '-i', tmp, '-ar', '16000', '-ac', '1', tmp_wav]
                    proc = subprocess.run(cmd, capture_output=True, text=True)
                    print(f"[predict] ffmpeg retry rc={proc.returncode} stdout={proc.stdout[:200]} stderr={proc.stderr[:200]}")
                    if proc.returncode == 0 and os.path.exists(tmp_wav):
                        input_image = audio_to_mel_image(tmp_wav)
                        use_path = tmp_wav
                    else:
                        raise RuntimeError(f"ffmpeg conversion failed: rc={proc.returncode}")
                else:
                    raise RuntimeError(f"audio_to_mel_image failed and conversion not available: {e}")

            # collect basic stats for debugging
            try:
                input_stats = {
                    'min': float(np.min(input_image)),
                    'max': float(np.max(input_image)),
                    'mean': float(np.mean(input_image)),
                    'std': float(np.std(input_image)),
                    'shape': list(input_image.shape)
                }
            except Exception:
                input_stats = None

            input_q, input_meta = quantize_input(input_image, input_details[0])

            interpreter.set_tensor(input_details[0]['index'], input_q)
            interpreter.invoke()

            raw_out = interpreter.get_tensor(output_details[0]['index'])
            output_float, out_meta = dequantize_output(raw_out, output_details[0])

            # output_float may already be probabilities (model exported with softmax)
            arr = output_float[0]
            # if values in [0,1] and sum approx 1, treat as probs directly
            if np.all(arr >= -1e-6) and np.all(arr <= 1.0 + 1e-6) and abs(np.sum(arr) - 1.0) < 1e-2:
                probs = arr.astype(float)
                probs_list = probs.tolist()
                logits = arr
                prob_mode = 'probabilities'
            else:
                logits = arr
                exps = np.exp(logits - np.max(logits))
                probs = (exps / np.sum(exps)).astype(float)
                probs_list = probs.tolist()
                prob_mode = 'logits+softmax'

            scores_map = {class_names[i]: float(probs_list[i]) for i in range(min(len(class_names), len(probs_list)))}
            top_k_idx = np.argsort(probs)[::-1][:3]
            top_k = [{"label": class_names[int(i)], "score": float(probs_list[int(i)])} for i in top_k_idx]

            pred_idx = int(np.argmax(probs))
            pred_label = class_names[pred_idx] if 0 <= pred_idx < len(class_names) else str(pred_idx)

            result = {
                "pred_idx": pred_idx,
                "pred_label": pred_label,
                "scores": probs_list,
                "scores_map": scores_map,
                "top_k": top_k,
                "prob_mode": prob_mode,
                "header_preview": header_preview,
            }
            # when debug mode requested, add internals so we can inspect why 'unknown' appears
            if debug_mode:
                try:
                    result.update({
                        'input_stats': input_stats,
                        'input_meta': input_meta,
                        'output_meta': out_meta,
                        'raw_output': raw_out.tolist(),
                        'logits': output_float[0].tolist(),
                        'class_names_len': len(class_names),
                    })
                    print(f"[predict] debug result included (input shape={input_stats.get('shape') if input_stats else 'n/a'})")
                except Exception:
                    pass
            try:
                print(f"[predict] result pred_label={pred_label} pred_idx={pred_idx} top1_score={probs_list[pred_idx] if 0<=pred_idx<len(probs_list) else None}")
            except Exception:
                pass

            return jsonify(result)

        except Exception as e:
            tb = traceback.format_exc()
            return jsonify({"error": str(e), "trace": tb}), 500
        finally:
            # cleanup temp files (both original and converted)
            try:
                if tmp and os.path.exists(tmp):
                    os.remove(tmp)
            except Exception:
                pass


    @app.route("/predict_debug", methods=["POST"])
    def predict_debug():
        if "file" not in request.files:
            return jsonify({"error": "no file provided"}), 400

        try:
            print(f"[predict_debug] method={request.method} remote_addr={request.remote_addr} origin={request.headers.get('Origin')}")
        except Exception:
            pass

        f = request.files["file"]
        tmp = None
        try:
            tmpf = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(f.filename)[1] or ".wav")
            tmp = tmpf.name
            tmpf.close()
            f.save(tmp)

            try:
                print(f"[predict_debug] upload filename={f.filename}")
            except Exception:
                pass

            input_image = audio_to_mel_image(tmp)
            stats = {
                'min': float(np.min(input_image)),
                'max': float(np.max(input_image)),
                'mean': float(np.mean(input_image)),
                'std': float(np.std(input_image)),
                'shape': list(input_image.shape)
            }

            input_q, input_meta = quantize_input(input_image, input_details[0])

            interpreter.set_tensor(input_details[0]['index'], input_q)
            interpreter.invoke()

            raw_out = interpreter.get_tensor(output_details[0]['index'])
            output_float, out_meta = dequantize_output(raw_out, output_details[0])

            arr = output_float[0]
            # detect if interpreter output is already a probability vector
            if np.all(arr >= -1e-6) and np.all(arr <= 1.0 + 1e-6) and abs(np.sum(arr) - 1.0) < 1e-2:
                probs = arr.tolist()
                logits = arr.tolist()
                prob_mode = 'probabilities'
            else:
                logits = arr.tolist()
                exps = np.exp(np.array(logits) - np.max(logits))
                probs = (exps / np.sum(exps)).tolist()
                prob_mode = 'logits+softmax'

            return jsonify({
                'input_stats': stats,
                'input_meta': input_meta,
                'output_meta': out_meta,
                'raw_output': raw_out.tolist(),
                'logits': logits,
                'probs': probs,
                'class_names': class_names,
                'prob_mode': prob_mode,
            })

        except Exception as e:
            tb = traceback.format_exc()
            return jsonify({"error": str(e), "trace": tb}), 500
        finally:
            if tmp and os.path.exists(tmp):
                try:
                    os.remove(tmp)
                except Exception:
                    pass


    return app


if __name__ == "__main__":
    app = create_app()
    # bind to 0.0.0.0 so mobile devices on the same LAN can reach the dev server
    # disable the reloader to avoid issues with native TF handles on Windows
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)
