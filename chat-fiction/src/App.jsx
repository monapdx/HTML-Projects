import React, { useState, useEffect, useRef } from "react";
import "./App.css";

function App() {
  const [title, setTitle] = useState("Untitled Chat Story");
  const [description, setDescription] = useState("");

  const [characters, setCharacters] = useState([
    { id: "c1", name: "Alex", side: "left", color: "#4f46e5" },
    { id: "c2", name: "Riley", side: "right", color: "#ec4899" },
  ]);

  // Messages: type "line" | "choice"
  // Choices: { id: "a" | "b", text: string, nextId?: string | null }
  const [messages, setMessages] = useState([
    {
      id: "m1",
      type: "line",
      senderId: "c1",
      text: "Hey. You awake?",
      delay: 800,
      choices: [
        { id: "a", text: "", nextId: null },
        { id: "b", text: "", nextId: null },
      ],
    },
    {
      id: "m2",
      type: "line",
      senderId: "c2",
      text: "Barely. What's up?",
      delay: 1200,
      choices: [
        { id: "a", text: "", nextId: null },
        { id: "b", text: "", nextId: null },
      ],
    },
    {
      id: "m3",
      type: "choice",
      senderId: "c1",
      text: "",
      delay: 1500,
      choices: [
        { id: "a", text: "It's nothing, never mind.", nextId: "m4" },
        { id: "b", text: "I think someone is outside.", nextId: "m5" },
      ],
    },
    {
      id: "m4",
      type: "line",
      senderId: "c2",
      text: "You can't text me at 3am and say it's nothing.",
      delay: 1500,
      choices: [
        { id: "a", text: "", nextId: null },
        { id: "b", text: "", nextId: null },
      ],
    },
    {
      id: "m5",
      type: "line",
      senderId: "c2",
      text: "Wait, what? Outside where?",
      delay: 1500,
      choices: [
        { id: "a", text: "", nextId: null },
        { id: "b", text: "", nextId: null },
      ],
    },
  ]);

  // --- Playback state (for Play Story) ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [visibleMessages, setVisibleMessages] = useState(messages);
  const [typingMessageId, setTypingMessageId] = useState(null);

  // which choice the player picked at each choice message
  const [selectedChoices, setSelectedChoices] = useState({}); // { [msgId]: "a" | "b" }

  const [waitingChoiceMessageId, setWaitingChoiceMessageId] = useState(null);
  const choiceResolverRef = useRef(null);

  // Keep preview in sync when not playing
  useEffect(() => {
    if (!isPlaying) {
      setVisibleMessages(messages);
    }
  }, [messages, isPlaying]);

  // ---------- Helpers: editor ----------

  const addCharacter = () => {
    const id = "c" + (characters.length + 1);
    setCharacters((prev) => [
      ...prev,
      {
        id,
        name: `Character ${prev.length + 1}`,
        side: prev.length % 2 === 0 ? "left" : "right",
        color: "#64748b",
      },
    ]);
  };

  const updateCharacter = (id, updates) => {
    setCharacters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const deleteCharacter = (id) => {
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    setMessages((prev) => prev.filter((m) => m.senderId !== id));
  };

  const addMessage = () => {
    if (!characters.length) return;
    const id = "m" + (messages.length + 1);
    setMessages((prev) => [
      ...prev,
      {
        id,
        type: "line",
        senderId: characters[0].id,
        text: "",
        delay: 0,
        choices: [
          { id: "a", text: "", nextId: null },
          { id: "b", text: "", nextId: null },
        ],
      },
    ]);
  };

  const updateMessage = (id, updates) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  const deleteMessage = (id) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const moveMessage = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= messages.length) return;
    setMessages((prev) => {
      const arr = [...prev];
      const temp = arr[index];
      arr[index] = arr[newIndex];
      arr[newIndex] = temp;
      return arr;
    });
  };

  const updateChoiceText = (msgId, choiceId, text) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const choices = m.choices || [
          { id: "a", text: "", nextId: null },
          { id: "b", text: "", nextId: null },
        ];
        return {
          ...m,
          choices: choices.map((c) =>
            c.id === choiceId ? { ...c, text } : c
          ),
        };
      })
    );
  };

  const updateChoiceNext = (msgId, choiceId, nextIdOrEmpty) => {
    const nextId = nextIdOrEmpty || null; // empty => default next-in-order
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const choices = m.choices || [
          { id: "a", text: "", nextId: null },
          { id: "b", text: "", nextId: null },
        ];
        return {
          ...m,
          choices: choices.map((c) =>
            c.id === choiceId ? { ...c, nextId } : c
          ),
        };
      })
    );
  };

  const downloadJSON = () => {
    const story = {
      title,
      description,
      characters,
      messages,
      exportedAt: new Date().toISOString(),
    };

    const json = JSON.stringify(story, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "chat-story"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Helpers: story graph / path ----------

  const getNextInOrderId = (msgId) => {
    const index = messages.findIndex((m) => m.id === msgId);
    if (index >= 0 && index + 1 < messages.length) {
      return messages[index + 1].id;
    }
    return null;
  };

  /**
   * Given the current selectedChoices map, compute the *unique linear path*
   * through the story that the player has taken (or would take) from message 0.
   * Returns a Set of message IDs on that path.
   * If no choices selected yet, returns null to mean "show everything".
   */
  const computePathIds = () => {
    if (!Object.keys(selectedChoices).length) return null;

    const idsOnPath = new Set();
    const idToIndex = new Map(messages.map((m, i) => [m.id, i]));

    let i = 0;
    while (i >= 0 && i < messages.length) {
      const msg = messages[i];
      if (!msg) break;

      idsOnPath.add(msg.id);

      if (msg.type === "choice") {
        const choiceKey = selectedChoices[msg.id];
        if (!choiceKey) break; // path stops here until player chooses

        const choices = msg.choices || [];
        const chosen = choices.find((c) => c.id === choiceKey);
        const targetId =
          (chosen && chosen.nextId) || getNextInOrderId(msg.id);
        if (!targetId) break;

        const nextIndex = idToIndex.get(targetId);
        if (nextIndex == null) break;
        i = nextIndex;
      } else {
        i = i + 1;
      }
    }

    return idsOnPath;
  };

  // ---------- Playback helpers ----------

  const stopPlayback = () => {
    setIsPlaying(false);
    setTypingMessageId(null);
    setWaitingChoiceMessageId(null);
    choiceResolverRef.current = null;
    setVisibleMessages(messages);
  };

  const handlePlayClick = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      setSelectedChoices({});
      setIsPlaying(true);
    }
  };

  // If structure changes while playing, stop playback
  useEffect(() => {
    if (isPlaying) {
      stopPlayback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, characters.length]);

  // Main playback effect: walk through messages with branching and typing
  useEffect(() => {
    if (!isPlaying || messages.length === 0) return;

    let cancelled = false;

    const sleep = (ms) =>
      new Promise((resolve) => {
        const id = setTimeout(() => {
          if (!cancelled) resolve();
        }, ms);
        return id;
      });

    const run = async () => {
      const idToIndex = new Map(messages.map((m, i) => [m.id, i]));

      setVisibleMessages([]);
      setTypingMessageId(null);
      setWaitingChoiceMessageId(null);

      let i = 0; // start from first message

      while (!cancelled && i >= 0 && i < messages.length) {
        const msg = messages[i];
        if (!msg) break;

        const delay = msg.delay || 0;

        // typing animation
        if (delay > 0) {
          setTypingMessageId(msg.id);
          await sleep(delay);
          if (cancelled) break;
          setTypingMessageId(null);
        }

        // reveal this message
        setVisibleMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });

        if (msg.type === "choice") {
          // wait for player to pick A or B
          const nextId = await new Promise((resolve) => {
            if (cancelled) return resolve(null);
            choiceResolverRef.current = resolve;
            setWaitingChoiceMessageId(msg.id);
          });

          setWaitingChoiceMessageId(null);
          choiceResolverRef.current = null;

          if (cancelled || !nextId) break;

          const nextIndex = idToIndex.get(nextId);
          if (nextIndex == null) break;
          i = nextIndex;
        } else {
          // normal line: just go to next in order
          i = i + 1;
        }

        await sleep(60); // tiny spacing so zero-delay lines still "pop"
      }

      if (!cancelled) {
        setIsPlaying(false);
        setTypingMessageId(null);
        setWaitingChoiceMessageId(null);
        choiceResolverRef.current = null;
        setVisibleMessages(messages);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [isPlaying, messages]);

  // Handle clicking a choice option in preview
  const handleChoiceClick = (msg, choice) => {
    const choiceId = choice.id;
    const targetId = choice.nextId || getNextInOrderId(msg.id);

    setSelectedChoices((prev) => ({
      ...prev,
      [msg.id]: choiceId,
    }));

    if (
      isPlaying &&
      waitingChoiceMessageId === msg.id &&
      choiceResolverRef.current
    ) {
      choiceResolverRef.current(targetId || null);
    }
  };

  // Typing bubble info
  const typingMessage =
    isPlaying && typingMessageId
      ? messages.find((m) => m.id === typingMessageId)
      : null;

  const typingSender = typingMessage
    ? characters.find((c) => c.id === typingMessage.senderId)
    : null;

  // Compute which message ids are actually on the chosen path
  const pathIds = computePathIds();

  // Base list to render (either animated subset or whole script)
  const previewMessagesBase = isPlaying ? visibleMessages : messages;

  // Final list shown in preview: filter to chosen path if any choices selected
  const previewMessages =
    pathIds == null
      ? previewMessagesBase
      : previewMessagesBase.filter((m) => pathIds.has(m.id));

  // Options for "Next message" dropdowns
  const messageOptions = messages.map((m, idx) => {
    const sender = characters.find((c) => c.id === m.senderId);
    const prefix = `#${idx + 1} `;
    const who = sender ? `${sender.name}: ` : "";
    const preview =
      m.type === "choice" ? "[Choice message]" : m.text || "…";
    const label = (prefix + who + preview).slice(0, 60);
    return { id: m.id, label };
  });

  // ---------- Render ----------

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Chat Story Builder</h1>
          <p>Create, preview, and download fiction chat conversations.</p>
        </div>
        <button className="primary-button" onClick={downloadJSON}>
          Download JSON
        </button>
      </header>

      <main className="app-main">
        {/* LEFT: Story + characters */}
        <section className="panel">
          <h2>Story Settings</h2>
          <label className="field">
            <span>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Chat Story"
            />
          </label>
          <label className="field">
            <span>Description (optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short blurb about your story..."
              rows={3}
            />
          </label>

          <div className="panel-divider" />

          <div className="panel-header-row">
            <h2>Characters</h2>
            <button className="secondary-button" onClick={addCharacter}>
              + Add Character
            </button>
          </div>

          <div className="list">
            {characters.map((char) => (
              <div key={char.id} className="character-card">
                <div className="character-color-wrapper">
                  <input
                    type="color"
                    value={char.color}
                    onChange={(e) =>
                      updateCharacter(char.id, { color: e.target.value })
                    }
                    className="color-input"
                    title="Bubble Color"
                  />
                </div>
                <div className="character-main">
                  <input
                    className="character-name-input"
                    value={char.name}
                    onChange={(e) =>
                      updateCharacter(char.id, { name: e.target.value })
                    }
                  />
                  <div className="character-meta">
                    <label>
                      Side:{" "}
                      <select
                        value={char.side}
                        onChange={(e) =>
                          updateCharacter(char.id, { side: e.target.value })
                        }
                      >
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                  </div>
                </div>
                <button
                  className="icon-button"
                  onClick={() => deleteCharacter(char.id)}
                  title="Delete character"
                >
                  ✕
                </button>
              </div>
            ))}
            {!characters.length && (
              <p className="empty-hint">
                No characters yet. Add at least one to start writing messages.
              </p>
            )}
          </div>
        </section>

        {/* CENTER: Messages editor */}
        <section className="panel">
          <div className="panel-header-row">
            <h2>Messages</h2>
            <button className="secondary-button" onClick={addMessage}>
              + Add Message
            </button>
          </div>
          {!messages.length && (
            <p className="empty-hint">
              No messages yet. Click &quot;Add Message&quot; to start your chat.
            </p>
          )}
          <div className="list messages-list">
            {messages.map((msg, index) => {
              const sender = characters.find((c) => c.id === msg.senderId);
              const type = msg.type || "line";
              const choices =
                msg.choices || [
                  { id: "a", text: "", nextId: null },
                  { id: "b", text: "", nextId: null },
                ];

              return (
                <div key={msg.id} className="message-row">
                  <div className="message-controls">
                    <button
                      className="icon-button"
                      onClick={() => moveMessage(index, -1)}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => moveMessage(index, 1)}
                      title="Move down"
                    >
                      ↓
                    </button>
                  </div>
                  <div className="message-main">
                    <div className="message-header">
                      <select
                        value={msg.senderId}
                        onChange={(e) =>
                          updateMessage(msg.id, { senderId: e.target.value })
                        }
                      >
                        {characters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>

                      <select
                        className="type-select"
                        value={type}
                        onChange={(e) =>
                          updateMessage(msg.id, { type: e.target.value })
                        }
                      >
                        <option value="line">Line</option>
                        <option value="choice">Choice</option>
                      </select>

                      <label className="delay-field">
                        Delay (ms)
                        <input
                          type="number"
                          min="0"
                          value={msg.delay}
                          onChange={(e) =>
                            updateMessage(msg.id, {
                              delay: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>
                      <button
                        className="icon-button"
                        onClick={() => deleteMessage(msg.id)}
                        title="Delete message"
                      >
                        ✕
                      </button>
                    </div>

                    {type === "line" ? (
                      <textarea
                        className="message-textarea"
                        value={msg.text}
                        onChange={(e) =>
                          updateMessage(msg.id, { text: e.target.value })
                        }
                        rows={2}
                        placeholder="Type the message text here..."
                      />
                    ) : (
                      <div className="choice-editor">
                        <label className="choice-field">
                          <span>Choice A</span>
                          <textarea
                            rows={2}
                            value={choices[0]?.text || ""}
                            onChange={(e) =>
                              updateChoiceText(msg.id, "a", e.target.value)
                            }
                            placeholder="First option..."
                          />
                          <div className="choice-next-row">
                            <span>Next:</span>
                            <select
                              value={choices[0]?.nextId || ""}
                              onChange={(e) =>
                                updateChoiceNext(
                                  msg.id,
                                  "a",
                                  e.target.value
                                )
                              }
                            >
                              <option value="">
                                (Next message in order)
                              </option>
                              {messageOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>
                        <label className="choice-field">
                          <span>Choice B</span>
                          <textarea
                            rows={2}
                            value={choices[1]?.text || ""}
                            onChange={(e) =>
                              updateChoiceText(msg.id, "b", e.target.value)
                            }
                            placeholder="Second option..."
                          />
                          <div className="choice-next-row">
                            <span>Next:</span>
                            <select
                              value={choices[1]?.nextId || ""}
                              onChange={(e) =>
                                updateChoiceNext(
                                  msg.id,
                                  "b",
                                  e.target.value
                                )
                              }
                            >
                              <option value="">
                                (Next message in order)
                              </option>
                              {messageOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>
                      </div>
                    )}

                    {sender && (
                      <p className="message-meta">
                        {type === "line" ? "Line" : "Choice"} from{" "}
                        {sender.name} on the{" "}
                        <strong>{sender.side}</strong> side.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* RIGHT: Live preview */}
        <section className="panel preview-panel">
          <div className="panel-header-row">
            <h2>Preview</h2>
            <button
              className="secondary-button"
              onClick={handlePlayClick}
              disabled={messages.length === 0}
            >
              {isPlaying ? "Stop" : "Play Story"}
            </button>
          </div>

          <div className="device-frame">
            <div className="device-header">
              <span className="device-title">
                {title || "Untitled Story"}
              </span>
            </div>
            <div className="device-body">
              <div className="chat-window">
                {previewMessages.length === 0 && !typingMessage && (
                  <div className="preview-empty">
                    Your conversation will appear here.
                  </div>
                )}

                {/* Visible messages (filtered to chosen path) */}
                {previewMessages.map((msg) => {
                  const type = msg.type || "line";
                  const sender = characters.find(
                    (c) => c.id === msg.senderId
                  );
                  if (!sender) return null;
                  const isLeft = sender.side === "left";
                  const choices =
                    msg.choices || [
                      { id: "a", text: "", nextId: null },
                      { id: "b", text: "", nextId: null },
                    ];
                  const selected = selectedChoices[msg.id] || null;

                  if (type === "line") {
                    return (
                      <div
                        key={msg.id}
                        className={`chat-row ${
                          isLeft ? "chat-left" : "chat-right"
                        }`}
                      >
                        {isLeft && (
                          <div className="avatar-circle">
                            {sender.name[0]?.toUpperCase()}
                          </div>
                        )}
                        <div
                          className="chat-bubble"
                          style={{ backgroundColor: sender.color }}
                        >
                          <div className="chat-text">
                            {msg.text || "…"}
                          </div>
                        </div>
                        {!isLeft && (
                          <div className="avatar-circle">
                            {sender.name[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Choice card
                  return (
                    <div
                      key={msg.id}
                      className={`chat-row ${
                        isLeft ? "chat-left" : "chat-right"
                      }`}
                    >
                      {isLeft && (
                        <div className="avatar-circle">
                          {sender.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="choice-card">
                        {choices.slice(0, 2).map((choice, idx) => {
                          const isSelected = selected === choice.id;
                          const labelFallback =
                            idx === 0 ? "Choice A" : "Choice B";
                          return (
                            <button
                              key={choice.id}
                              className={
                                "choice-option" +
                                (isSelected
                                  ? " choice-option-selected"
                                  : "")
                              }
                              onClick={() =>
                                handleChoiceClick(msg, choice)
                              }
                            >
                              {choice.text || labelFallback}
                            </button>
                          );
                        })}
                      </div>
                      {!isLeft && (
                        <div className="avatar-circle">
                          {sender.name[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Typing indicator at the bottom during playback */}
                {typingMessage && typingSender && (
                  <div
                    className={`chat-row ${
                      typingSender.side === "left"
                        ? "chat-left"
                        : "chat-right"
                    }`}
                  >
                    {typingSender.side === "left" && (
                      <div className="avatar-circle">
                        {typingSender.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div
                      className="chat-bubble typing-bubble"
                      style={{ backgroundColor: typingSender.color }}
                    >
                      <div className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                    {typingSender.side === "right" && (
                      <div className="avatar-circle">
                        {typingSender.name[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="preview-hint">
            Each Choice message can route A/B to different follow-up lines
            using the &quot;Next&quot; dropdown. Only the chosen branch is
            shown once a choice is selected.
          </p>
        </section>
      </main>
    </div>
  );
}

export default App;
