import { useEffect, useState } from 'preact/hooks';
import { currentUpdate, dismissUpdateMessage, onUpdate, restartIntoNewVersion, updateText } from '../update';

/** The line under the header that says what the app is downloading, or that a new version is ready (src/update.ts). */
export function UpdateBar({ addingFind }: { addingFind: boolean }) {
  const [s, setS] = useState(currentUpdate);
  useEffect(() => onUpdate(setS), []);
  const say = updateText(s, addingFind);
  if (!say) return null;
  return (
    <div class="update-bar" role="status" data-test="update-bar">
      <span>{say.text}</span>
      {say.percent !== undefined && (
        <span class="update-progress" aria-hidden="true"><span style={`width:${say.percent}%`} /></span>
      )}
      {say.action === 'restart' && <button type="button" onClick={restartIntoNewVersion}>Restart</button>}
      {say.action === 'dismiss' && <button type="button" onClick={dismissUpdateMessage}>OK</button>}
    </div>
  );
}
