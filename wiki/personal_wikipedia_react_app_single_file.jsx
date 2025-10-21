import React, { useEffect, useMemo, useRef, useState } from "react";

// Personal Wikipedia — single-file React app
// - Wikipedia-like layout & typography
// - Structured editor (title, infobox, sections, references)
// - Auto-numbered citation markers [1], [2], ... with anchors
// - Table of contents
// - Neutral-tone helper flags first-person language & superlatives
// - LocalStorage persistence, JSON import/export, and HTML export
// - TailwindCSS for styling (available in Canvas)

// ---------- Utilities ----------
const STORAGE_KEY = "personal-wikipedia-doc-v1";

const defaultDoc = {
  title: "Your Name",
  subtitle: "(born —)",
  lead: "Write a neutral lead section summarizing who you are, what you do, and why you are notable in your own story.",
  infobox: {
    image: "",
    caption: "",
    name: "Your Name",
    born: "",
    residence: "",
    occupation: "",
    knownFor: "",
    yearsActive: "",
    website: "",
  },
  sections: [
    {
      id: cryptoId(),
      heading: "Early life",
      content:
        "Describe early life context in neutral voice. Avoid first-person pronouns (I, me, my).",
    },
    {
      id: cryptoId(),
      heading: "Career",
      content: "Key milestones, projects, and roles, written factually with dates.",
    },
  ],
  references: [
    {
      id: cryptoId(),
      title: "Moved to Portland (personal calendar entry)",
      date: "2018-06-01",
      url: "",
      note: "Personal life event — used as source for relocation date.",
    },
  ],
};

function cryptoId() {
  return Math.random().toString(36).slice(2, 10);
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

// Very tiny markdown-ish renderer (headings, bold, italics, links, lists, line breaks)
function renderLiteMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // links [text](url)
  html = html.replace(/\[(.+?)\]\((https?:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  // bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // italics *text*
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // simple lists
  const lines = html.split(/\n/);
  let inUl = false;
  const out = [];
  for (const line of lines) {
    if (/^\s*[-•]\s+/.test(line)) {
      if (!inUl) {
        inUl = true;
        out.push("<ul>");
      }
      out.push(`<li>${line.replace(/^\s*[-•]\s+/, "")}</li>`);
    } else {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (/^\s*#\s+/.test(line)) {
        out.push(`<h2>${line.replace(/^\s*#\s+/, "")}</h2>`);
      } else if (/^\s*##\s+/.test(line)) {
        out.push(`<h3>${line.replace(/^\s*##\s+/, "")}</h3>`);
      } else if (line.trim() === "") {
        out.push("<br/>");
      } else {
        out.push(`<p>${line}</p>`);
      }
    }
  }
  if (inUl) out.push("</ul>");
  return out.join("\n");
}

function useLocalStorageState(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState];
}

function download(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Neutral tone helper flags
function analyzeTone({ title, lead, sections }) {
  const text = [title, lead, ...sections.map((s) => s.content)].join("\n\n");
  const lower = text.toLowerCase();
  const firstPerson = (lower.match(/\b(i|me|my|mine|myself)\b/g) || []).length;
  const superlatives = (lower.match(/\b(best|greatest|amazing|unparalleled|extraordinary|unique|incredible|outstanding)\b/g) || []).length;
  const exclamations = (text.match(/!/g) || []).length;
  return { firstPerson, superlatives, exclamations };
}

// ---------- Components ----------
function ToolbarButton({ onClick, children, title, className }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={classNames(
        "px-3 py-1 rounded-xl border text-sm shadow-sm hover:bg-gray-50",
        className
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 mb-3">
      <span className="text-xs uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function Infobox({ data }) {
  const hasImage = data.image && data.image.trim() !== "";
  return (
    <aside className="infobox w-[300px] float-right ml-6 mb-4 border border-gray-300 bg-white/70 text-sm">
      <div className="text-center font-semibold px-3 py-2 bg-gray-100 border-b">{data.name || "Infobox person"}</div>
      {hasImage && (
        <figure className="p-3 border-b">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.image} alt={data.caption || data.name} className="mx-auto max-h-64 object-contain" />
          {data.caption && <figcaption className="mt-2 text-xs text-gray-600">{data.caption}</figcaption>}
        </figure>
      )}
      <dl className="p-3 space-y-2">
        {data.born && <Item dt="Born" dd={data.born} />}
        {data.residence && <Item dt="Residence" dd={data.residence} />}
        {data.occupation && <Item dt="Occupation" dd={data.occupation} />}
        {data.knownFor && <Item dt="Known for" dd={data.knownFor} />}
        {data.yearsActive && <Item dt="Years active" dd={data.yearsActive} />}
        {data.website && (
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <dt className="font-semibold">Website</dt>
            <dd className="truncate">
              <a href={normalizeUrl(data.website)} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                {data.website}
              </a>
            </dd>
          </div>
        )}
      </dl>
    </aside>
  );
}

function Item({ dt, dd }) {
  return (
    <div className="grid grid-cols-[1fr_2fr] gap-2">
      <dt className="font-semibold">{dt}</dt>
      <dd>{dd}</dd>
    </div>
  );
}

function TableOfContents({ sections }) {
  if (!sections?.length) return null;
  return (
    <nav className="border border-gray-300 bg-white/70 p-3 mb-4 w-[300px] text-sm">
      <div className="font-semibold mb-2">Contents</div>
      <ol className="list-decimal ml-5 space-y-1">
        {sections.map((s, idx) => (
          <li key={s.id}>
            <a className="text-blue-700 hover:underline" href={`#sec-${slugify(s.heading)}`}>
              {idx + 1}. {s.heading || "Untitled section"}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function slugify(x = "") {
  return x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeUrl(u) {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return "https://" + u;
}

function ReferenceList({ references }) {
  return (
    <section className="mt-6" id="references">
      <h2 className="text-xl font-semibold border-b pb-1">References</h2>
      <ol className="list-decimal ml-5 mt-3 space-y-2">
        {references.map((ref, i) => (
          <li key={ref.id} id={`ref-${i + 1}`}>
            <span className="block">
              {ref.url ? (
                <a href={normalizeUrl(ref.url)} className="text-blue-700 hover:underline" target="_blank" rel="noreferrer">
                  {ref.title || `Source ${i + 1}`}
                </a>
              ) : (
                <span>{ref.title || `Source ${i + 1}`}</span>
              )}
              {ref.date && <span className="text-gray-600"> — {ref.date}</span>}
            </span>
            {ref.note && <div className="text-gray-700 text-sm">{ref.note}</div>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function CitationPicker({ references, onInsert }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <ToolbarButton onClick={() => setOpen(true)} title="Insert citation">Insert citation</ToolbarButton>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-[560px] max-w-[92vw] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Insert citation</h3>
              <button onClick={() => setOpen(false)} className="px-2 py-1 rounded hover:bg-gray-100">✕</button>
            </div>
            <div className="max-h-[50vh] overflow-auto divide-y">
              {references.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => {
                    onInsert(i + 1);
                    setOpen(false);
                  }}
                  className="w-full text-left p-3 hover:bg-gray-50"
                >
                  <div className="font-medium">[{i + 1}] {r.title || `Source ${i + 1}`}</div>
                  <div className="text-sm text-gray-600 flex gap-2">
                    {r.date && <span>{r.date}</span>}
                    {r.url && <span className="truncate">{r.url}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExportMenu({ doc }) {
  function exportJSON() {
    download(`${slugify(doc.title) || "personal-wikipedia"}.json`, JSON.stringify(doc, null, 2));
  }
  function exportHTML() {
    const html = renderExportHTML(doc);
    download(`${slugify(doc.title) || "personal-wikipedia"}.html`, html);
  }
  return (
    <div className="flex gap-2">
      <ToolbarButton onClick={exportJSON} title="Download JSON">Export JSON</ToolbarButton>
      <ToolbarButton onClick={exportHTML} title="Download a standalone HTML page">Export HTML</ToolbarButton>
    </div>
  );
}

function renderExportHTML(doc) {
  const page = document.getElementById("wiki-page");
  const outerHtml = page ? page.outerHTML : "";
  // Minimal standalone HTML that mirrors the preview contents
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(doc.title)} — Personal Wikipedia</title>
<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
<style>
  body{background:#f8f9fa}
  .mw-page{max-width:980px;margin:0 auto;background:white;padding:1.5rem}
  .infobox dt{font-weight:600}
  .wiki-link{color:#1a4ba3}
</style>
</head>
<body>
<div class="mw-page">${outerHtml}</div>
</body>
</html>`;
}

function escapeHtml(s = "") {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function App() {
  const [doc, setDoc] = useLocalStorageState(STORAGE_KEY, defaultDoc);
  const [tab, setTab] = useState("write"); // write | preview
  const fileInputRef = useRef(null);

  const tone = useMemo(() => analyzeTone(doc), [doc]);

  function update(path, value) {
    setDoc((d) => {
      const copy = JSON.parse(JSON.stringify(d));
      let ptr = copy;
      for (let i = 0; i < path.length - 1; i++) ptr = ptr[path[i]];
      ptr[path[path.length - 1]] = value;
      return copy;
    });
  }

  function addSection() {
    setDoc((d) => ({
      ...d,
      sections: [...d.sections, { id: cryptoId(), heading: "New section", content: "" }],
    }));
  }

  function removeSection(id) {
    setDoc((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== id) }));
  }

  function addReference() {
    setDoc((d) => ({
      ...d,
      references: [
        ...d.references,
        { id: cryptoId(), title: "", date: "", url: "", note: "" },
      ],
    }));
  }

  function removeReference(id) {
    setDoc((d) => ({ ...d, references: d.references.filter((r) => r.id !== id) }));
  }

  function handleImportJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = JSON.parse(String(reader.result));
        setDoc(next);
      } catch (err) {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // reset
  }

  function insertCitation(number) {
    // inserts " [n]" where the cursor is in the current focused textarea
    const el = document.activeElement;
    const marker = ` [${number}]`;
    if (el && el.tagName === "TEXTAREA") {
      const textarea = el;
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? start;
      const value = textarea.value;
      const next = value.slice(0, start) + marker + value.slice(end);
      textarea.value = next;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + marker.length;
    } else {
      navigator.clipboard?.writeText(marker);
      alert(`Copied ${marker} to clipboard. Paste it where you need the citation.`);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="text-2xl font-serif">Personal Wikipedia</div>
          <div className="ml-auto flex items-center gap-2">
            <ToolbarButton onClick={() => setTab("write")} className={tab === "write" ? "bg-gray-50" : ""}>
              Edit
            </ToolbarButton>
            <ToolbarButton onClick={() => setTab("preview")} className={tab === "preview" ? "bg-gray-50" : ""}>
              Preview
            </ToolbarButton>
            <ExportMenu doc={doc} />
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleImportJSON}
              />
              <ToolbarButton onClick={() => fileInputRef.current?.click()} title="Import JSON">Import</ToolbarButton>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === "write" ? (
          <div className="grid md:grid-cols-[360px_1fr] gap-6">
            {/* Left: meta + references */}
            <div>
              <div className="bg-white rounded-2xl shadow-sm border p-4 mb-6">
                <h3 className="font-semibold mb-3">Article</h3>
                <Field label="Title">
                  <input
                    className="border rounded-xl px-3 py-2"
                    value={doc.title}
                    onChange={(e) => update(["title"], e.target.value)}
                  />
                </Field>
                <Field label="Subtitle (optional)">
                  <input
                    className="border rounded-xl px-3 py-2"
                    value={doc.subtitle || ""}
                    onChange={(e) => update(["subtitle"], e.target.value)}
                  />
                </Field>
                <Field label="Lead (opening paragraph)">
                  <textarea
                    className="border rounded-xl px-3 py-2 h-28"
                    value={doc.lead}
                    onChange={(e) => update(["lead"], e.target.value)}
                  />
                </Field>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>Neutral tone helper:</span>
                  <span>I-words: <b>{tone.firstPerson}</b></span>
                  <span>Superlatives: <b>{tone.superlatives}</b></span>
                  <span>! marks: <b>{tone.exclamations}</b></span>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">References (personal sources)</h3>
                  <ToolbarButton onClick={addReference}>Add</ToolbarButton>
                </div>
                <div className="space-y-3">
                  {doc.references.map((r, i) => (
                    <div key={r.id} className="border rounded-xl p-3">
                      <div className="text-sm text-gray-600 mb-2">[{i + 1}]</div>
                      <Field label="Title / description">
                        <input
                          className="border rounded-xl px-3 py-2"
                          value={r.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDoc((d) => ({
                              ...d,
                              references: d.references.map((x) => (x.id === r.id ? { ...x, title: val } : x)),
                            }));
                          }}
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Date">
                          <input
                            type="date"
                            className="border rounded-xl px-3 py-2"
                            value={r.date || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDoc((d) => ({
                                ...d,
                                references: d.references.map((x) => (x.id === r.id ? { ...x, date: val } : x)),
                              }));
                            }}
                          />
                        </Field>
                        <Field label="URL (optional)">
                          <input
                            className="border rounded-xl px-3 py-2"
                            placeholder="https://..."
                            value={r.url}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDoc((d) => ({
                                ...d,
                                references: d.references.map((x) => (x.id === r.id ? { ...x, url: val } : x)),
                              }));
                            }}
                          />
                        </Field>
                      </div>
                      <Field label="Note (context)">
                        <input
                          className="border rounded-xl px-3 py-2"
                          value={r.note || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDoc((d) => ({
                              ...d,
                              references: d.references.map((x) => (x.id === r.id ? { ...x, note: val } : x)),
                              }));
                          }}
                        />
                      </Field>
                      <div className="flex items-center justify-between">
                        <button
                          className="text-xs text-blue-700 hover:underline"
                          onClick={() => insertCitation(i + 1)}
                        >
                          Insert [${""}{i + 1}] at cursor
                        </button>
                        <button className="text-xs text-red-600 hover:underline" onClick={() => removeReference(r.id)}>
                          Remove reference
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: content sections & infobox */}
            <div>
              <div className="bg-white rounded-2xl shadow-sm border p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Infobox (person)</h3>
                  <div className="text-xs text-gray-600">Appears on the right in preview</div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="Name">
                    <input className="border rounded-xl px-3 py-2" value={doc.infobox.name}
                      onChange={(e) => update(["infobox", "name"], e.target.value)} />
                  </Field>
                  <Field label="Image URL">
                    <input className="border rounded-xl px-3 py-2" value={doc.infobox.image}
                      onChange={(e) => update(["infobox", "image"], e.target.value)} />
                  </Field>
                  <Field label="Caption">
                    <input className="border rounded-xl px-3 py-2" value={doc.infobox.caption}
                      onChange={(e) => update(["infobox", "caption"], e.target.value)} />
                  </Field>
                  <Field label="Born">
                    <input className="border rounded-xl px-3 py-2" value={doc.infobox.born}
                      onChange={(e) => update(["infobox", "born"], e.target.value)} />
                  </Field>
                  <Field label="Residence">
                    <input className="border rounded-xl px-3 py-2" value={doc.infobox.residence}
                      onChange={(e) => update(["infobox", "residence"], e.target.value)} />
                  </Field>
                  <Field label="Occupation">
                    <input className="border rounded-xl px-3 py-2" value={doc.infobox.occupation}
                      onChange={(e) => update(["infobox", "occupation"], e.target.value)} />
                  </Field>
                  <Field label="Known for">
                    <input className="border rounded-xl px-3 py-2" value={doc.infobox.knownFor}
                      onChange={(e) => update(["infobox", "knownFor"], e.target.value)} />
                  </Field>
                  <Field label="Years active">
                    <input className="border rounded-xl px-3 py-2" value={doc.infobox.yearsActive}
                      onChange={(e) => update(["infobox", "yearsActive"], e.target.value)} />
                  </Field>
                  <Field label="Website">
                    <input className="border rounded-xl px-3 py-2" value={doc.infobox.website}
                      onChange={(e) => update(["infobox", "website"], e.target.value)} />
                  </Field>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Sections</h3>
                  <div className="flex gap-2 items-center">
                    <CitationPicker references={doc.references} onInsert={insertCitation} />
                    <ToolbarButton onClick={addSection}>Add section</ToolbarButton>
                  </div>
                </div>
                <div className="space-y-6">
                  {doc.sections.map((s, idx) => (
                    <div key={s.id} className="border rounded-2xl p-3">
                      <div className="grid md:grid-cols-[1fr_auto] gap-2 items-start">
                        <Field label={`Section ${idx + 1} heading`}>
                          <input
                            className="border rounded-xl px-3 py-2"
                            value={s.heading}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDoc((d) => ({
                                ...d,
                                sections: d.sections.map((x) => (x.id === s.id ? { ...x, heading: val } : x)),
                              }));
                            }}
                          />
                        </Field>
                        <button className="text-red-600 text-sm hover:underline" onClick={() => removeSection(s.id)}>
                          Remove
                        </button>
                      </div>
                      <Field label="Content (supports simple Markdown: headings #, **bold**, *italics*, lists -)">
                        <textarea
                          className="border rounded-xl px-3 py-2 h-40 font-mono"
                          value={s.content}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDoc((d) => ({
                              ...d,
                              sections: d.sections.map((x) => (x.id === s.id ? { ...x, content: val } : x)),
                            }));
                          }}
                        />
                      </Field>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ArticlePreview doc={doc} />
        )}
      </main>

      <footer className="text-center text-xs text-gray-500 pb-8">Made for private autobiographical mock entries. Store personal sources responsibly.</footer>
    </div>
  );
}

function ArticlePreview({ doc }) {
  const sectionsWithIds = doc.sections.map((s) => ({ ...s, anchor: `sec-${slugify(s.heading)}` }));
  const processedSections = sectionsWithIds.map((s) => ({
    ...s,
    html: renderLiteMarkdown(linkifyCitations(s.content, doc.references.length)),
  }));
  const leadHtml = renderLiteMarkdown(linkifyCitations(doc.lead, doc.references.length));

  return (
    <div id="wiki-page" className="mw-page bg-white rounded-2xl shadow-sm border p-6">
      <div className="border-b pb-1 mb-3">
        <h1 className="text-3xl font-serif">{doc.title || "Untitled"}</h1>
        {doc.subtitle && <div className="text-gray-700">{doc.subtitle}</div>}
      </div>

      <TableOfContents sections={sectionsWithIds} />
      <Infobox data={doc.infobox} />

      <article className="prose max-w-none">
        <div className="mb-4" dangerouslySetInnerHTML={{ __html: leadHtml }} />
        {processedSections.map((s) => (
          <section key={s.id} className="mb-6">
            <h2 id={s.anchor} className="text-xl font-semibold border-b pb-1">{s.heading}</h2>
            <div className="mt-2" dangerouslySetInnerHTML={{ __html: s.html }} />
          </section>
        ))}
        <ReferenceList references={doc.references} />
      </article>

      <style>{`
        .mw-page { font-family: Georgia, 'Times New Roman', serif; }
        .mw-page a { color: #1a4ba3; }
        .prose p { margin: 0.5rem 0; }
        .infobox dd, .infobox dt { font-family: system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji'; }
      `}</style>
    </div>
  );
}

function linkifyCitations(text, max) {
  // Transform occurrences like [1] to anchored links if within range
  return (text || "").replace(/\[(\d+)\]/g, (m, n) => {
    const idx = Number(n);
    if (!idx || idx < 1 || idx > max) return m;
    return `<sup><a class="text-blue-700 hover:underline" href="#ref-${idx}">[${idx}]</a></sup>`;
  });
}
