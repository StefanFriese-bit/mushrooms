import { render } from 'preact';
import { App } from './app';
import { keepData } from './storage';
import { startUpdates } from './update';
import './styles.css';

render(<App />, document.getElementById('app')!);
startUpdates();
void keepData(); // ask once at start; About shows the answer
