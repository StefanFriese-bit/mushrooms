import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { keepData } from './storage';
import './styles.css';

render(<App />, document.getElementById('app')!);
registerSW({ immediate: true });
void keepData(); // ask once at start; About shows the answer
