import { useCallback, useEffect, useState } from "react";
import type { Note, NoteStatus } from "../types";
import { loadNotes, saveNotes, uid, nowSecs } from "../lib/storage";

// ============================================================
// useNotes — note CRUD backed by localStorage
// ============================================================

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());

  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  const createNote = useCallback((title = "新想法", content = "") => {
    const note: Note = {
      id: uid(),
      title,
      content,
      status: "not_started",
      createdAt: nowSecs(),
      updatedAt: nowSecs(),
    };
    setNotes((prev) => [note, ...prev]);
    return note;
  }, []);

  const updateNote = useCallback(
    (
      id: string,
      patch: Partial<Pick<Note, "title" | "content" | "mvp">>,
    ) => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, ...patch, updatedAt: nowSecs() } : n,
        ),
      );
    },
    [],
  );

  const setNoteStatus = useCallback(
    (id: string, next: NoteStatus | ((prev: NoteStatus) => NoteStatus)) => {
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n;
          const status = typeof next === "function" ? next(n.status) : next;
          return { ...n, status, updatedAt: nowSecs() };
        }),
      );
    },
    [],
  );

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const replaceNoteContent = useCallback(
    (id: string, content: string, mvp?: string) => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, content, mvp, updatedAt: nowSecs() } : n,
        ),
      );
    },
    [],
  );

  const setNoteMVP = useCallback((id: string, mvp: string) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, mvp, updatedAt: nowSecs() } : n,
      ),
    );
  }, []);

  return {
    notes,
    createNote,
    updateNote,
    setNoteStatus,
    deleteNote,
    replaceNoteContent,
    setNoteMVP,
  };
}