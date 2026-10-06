import learn from '../../content/learn.json';

type Section = { title: string; points: string[]; sources: Array<{ title: string; url: string }> };

export function Learn() {
  return (
    <>
      <h1>Learn</h1>
      {(learn as Section[]).map((sec) => (
        <div class="card" key={sec.title}>
          <h2>{sec.title}</h2>
          <ul>{sec.points.map((p) => <li key={p}>{p}</li>)}</ul>
          <p class="muted">Sources: {sec.sources.map((s, i) => <span key={s.url}>{i ? ', ' : ''}<a href={s.url}>{s.title}</a></span>)}</p>
        </div>
      ))}
    </>
  );
}
