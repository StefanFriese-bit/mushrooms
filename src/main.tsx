import { render } from 'preact';
import { App } from './app';
import { keepData } from './storage';
import { startUpdates } from './update';
import { startCloudBackup } from './finds/cloud-backup';
import { listFinds, onFindsChanged } from './finds/store';
import { resumeAfterClose } from './finds/track-recorder';
import './styles.css';

// An iPhone shows a button's pressed look (:active) only on a page that listens for touches: without this every tap
// looked as if it had not landed (Stefan 24/10/2026, "it doesn't respond"). It does nothing else.
document.addEventListener('touchstart', () => {}, { passive: true });
render(<App />, document.getElementById('app')!);
startUpdates();
void keepData(); // ask once at start; About shows the answer
startCloudBackup(listFinds, onFindsChanged);
void resumeAfterClose(); // a walk still being recorded when the app was closed carries on (src/finds/track-recorder.ts) // the locations to GitHub by themselves, once a key is on the phone
