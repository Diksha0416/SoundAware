import 'react-native-gesture-handler';
// top of file, before app mounts
global.BACKEND_URL = 'http://192.168.29.32:5000';
import { registerRootComponent } from 'expo';
import App from './app/_layout';

// Register the root component
registerRootComponent(App);
