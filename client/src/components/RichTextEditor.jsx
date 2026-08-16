import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo,
  Redo
} from 'lucide-react';

export default function RichTextEditor({
  initialContent = '',
  onChange,
  onBurstDetected,
  editable = true,
  placeholder = 'Begin typing your report directly here...'
}) {
  const lastTextLen = useRef(0);
  const lastChangeTime = useRef(Date.now());

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Underline,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
        showOnlyWhenEditable: true
      })
    ],
    content: initialContent || '<p></p>',
    editable,
    editorProps: {
      attributes: {
        spellcheck: 'false',
        'data-gramm': 'false',
        'data-enable-grammarly': 'false',
        class: 'tiptap ProseMirror'
      },
      handlePaste: (view, event, slice) => {
        // Hard block any paste inside editor canvas
        event.preventDefault();
        return true;
      },
      handleDrop: (view, event, slice, moved) => {
        // Block drag-and-drop external text
        event.preventDefault();
        return true;
      }
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      const now = Date.now();
      const timeDelta = now - lastChangeTime.current;
      const charDelta = text.length - lastTextLen.current;

      // Burst cadence check: > 50 characters inserted in < 150ms without paste event
      if (charDelta > 50 && timeDelta < 200 && onBurstDetected) {
        onBurstDetected({
          charDelta,
          timeDelta
        });
      }

      lastTextLen.current = text.length;
      lastChangeTime.current = now;

      // Word count calculation
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const chars = text.length;

      if (onChange) {
        onChange({
          html,
          text,
          wordCount: words,
          charCount: chars
        });
      }
    }
  }, []);

  if (!editor) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading Rich Text Editor...
      </div>
    );
  }

  return (
    <div className="editor-wrapper">
      {/* Sticky Top Formatting Toolbar */}
      {editable && (
        <div className="editor-toolbar">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`toolbar-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
            title="Bold (Ctrl+B)"
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`toolbar-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
            title="Italic (Ctrl+I)"
          >
            <Italic size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`toolbar-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon size={16} />
          </button>

          <div className="toolbar-divider" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`toolbar-btn ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`}
            title="Heading 1"
          >
            <Heading1 size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`}
            title="Heading 2"
          >
            <Heading2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`toolbar-btn ${editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}`}
            title="Heading 3"
          >
            <Heading3 size={16} />
          </button>

          <div className="toolbar-divider" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`toolbar-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`}
            title="Bullet List"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`toolbar-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`}
            title="Numbered List"
          >
            <ListOrdered size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`toolbar-btn ${editor.isActive('blockquote') ? 'is-active' : ''}`}
            title="Quote"
          >
            <Quote size={16} />
          </button>

          <div className="toolbar-divider" />

          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="toolbar-btn"
            title="Undo"
          >
            <Undo size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="toolbar-btn"
            title="Redo"
          >
            <Redo size={16} />
          </button>
        </div>
      )}

      {/* Editor Scroll Canvas occupying 100% available space */}
      <div
        className="editor-scroll-area"
        onClick={(e) => {
          if (e.target === e.currentTarget && editor) {
            editor.commands.focus('end');
          }
        }}
      >
        <EditorContent
          editor={editor}
          style={{ flex: 1, minHeight: '100%', height: '100%', display: 'flex', flexDirection: 'column', cursor: 'text' }}
        />
      </div>
    </div>
  );
}
