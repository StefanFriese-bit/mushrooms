import { render } from 'preact';
import { App } from './app';
import { keepData } from './storage';
import { startUpdates } from './update';
import { startCloudBackup } from './finds/cloud-backup';
import { listFinds, onFindsChanged } from './finds/store';
import { resumeAfterClose } from './finds/track-recorder';
import './styles.css';

render(<App />, document.getElementById('app')!);
startUpdates();
void keepData(); // ask once at start; About shows the answer
startCloudBackup(listFinds, onFindsChanged);
void resumeAfterClose(); // a walk still being recorded when the app was closed carries on (src/finds/track-recorder.ts) // the locations to GitHub by themselves, once a key is on the phone
