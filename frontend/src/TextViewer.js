import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';

const API = '';

function getLanguage(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    php: 'php',
    py: 'python',
    rb: 'ruby',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    sql: 'sql',
    md: 'markdown',
    txt: 'text',
    log: 'text',
    env: 'bash',
    ini: 'ini',
    conf: 'ini',
    config: 'ini',
    htaccess: 'apacheconf',
    gitignore: 'gitignore',
  };
  return map[ext] || 'text';
}

const markdownComponents = {
  code({ inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={match[1]}
        PreTag="div"
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code
        className={className}
        {...props}
        style={{
          background: '#0f3460',
          padding: '2px 6px',
          borderRadius: 4,
          fontFamily: 'monospace',
          fontSize: '0.95em',
        }}
      >
        {children}
      </code>
    );
  },
  pre({ children }) {
    return <pre style={{ margin: 0, overflow: 'auto' }}>{children}</pre>;
  },
};

// Inyectar estilos Markdown una sola vez
if (typeof document !== 'undefined' && !document.getElementById('fm-markdown-styles')) {
  const style = document.createElement('style');
  style.id = 'fm-markdown-styles';
  style.textContent = `
    .markdown-body {
      font-size: 15px;
      line-height: 1.7;
      color: #eee;
    }
    .markdown-body h1,
    .markdown-body h2,
    .markdown-body h3,
    .markdown-body h4,
    .markdown-body h5,
    .markdown-body h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
      color: #fff;
    }
    .markdown-body h1 { font-size: 2em; border-bottom: 1px solid #333; padding-bottom: 8px; }
    .markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid #333; padding-bottom: 6px; }
    .markdown-body h3 { font-size: 1.25em; }
    .markdown-body h4 { font-size: 1em; }
    .markdown-body h5 { font-size: 0.875em; }
    .markdown-body h6 { font-size: 0.85em; color: #aaa; }
    .markdown-body p {
      margin-bottom: 16px;
    }
    .markdown-body ul,
    .markdown-body ol {
      margin-bottom: 16px;
      padding-left: 32px;
    }
    .markdown-body li {
      margin-bottom: 4px;
    }
    .markdown-body li > p {
      margin-bottom: 8px;
    }
    .markdown-body a {
      color: #4cc9f0;
      text-decoration: none;
    }
    .markdown-body a:hover {
      text-decoration: underline;
    }
    .markdown-body blockquote {
      margin: 0 0 16px 0;
      padding: 4px 16px;
      border-left: 4px solid #0f3460;
      color: #aaa;
    }
    .markdown-body blockquote > :last-child {
      margin-bottom: 0;
    }
    .markdown-body hr {
      margin: 24px 0;
      border: none;
      border-top: 1px solid #333;
    }
    .markdown-body table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .markdown-body th,
    .markdown-body td {
      border: 1px solid #333;
      padding: 8px 12px;
      text-align: left;
    }
    .markdown-body th {
      background: #0f3460;
      font-weight: 600;
    }
    .markdown-body tr:nth-child(even) {
      background: rgba(255, 255, 255, 0.03);
    }
    .markdown-body img {
      max-width: 100%;
      border-radius: 6px;
      margin: 8px 0;
    }
    .markdown-body pre {
      margin-bottom: 16px;
      border-radius: 6px;
    }
    .markdown-body code {
      font-family: monospace;
    }
    .markdown-body > :first-child {
      margin-top: 0;
    }
    .markdown-body > :last-child {
      margin-bottom: 0;
    }
  `;
  document.head.appendChild(style);
}

export default function TextViewer({ filePath, fileName }) {
  const [content, setContent] = useState('');
  const [encoding, setEncoding] = useState('utf-8');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    axios
      .get(`${API}/api/read?path=${encodeURIComponent(filePath)}`)
      .then((res) => {
        if (cancelled) return;
        setContent(res.data.content);
        setEncoding(res.data.encoding || 'utf-8');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.error || err.message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  if (loading) return <p>Cargando contenido...</p>;
  if (error) return <p style={{ color: '#e74c3c' }}>{error}</p>;

  const isMarkdown = fileName.toLowerCase().endsWith('.md');

  return (
    <div
      style={{
        height: '75vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#1a1a2e',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #333',
          color: '#888',
          fontSize: 12,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>📄 {fileName}</span>
        <span>Codificación: {encoding}</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {isMarkdown ? (
          <div className="markdown-body" style={{ color: '#eee', lineHeight: 1.6 }}>
            <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
          </div>
        ) : (
          <SyntaxHighlighter
            language={getLanguage(fileName)}
            style={vscDarkPlus}
            showLineNumbers
            wrapLines
            customStyle={{
              margin: 0,
              borderRadius: 6,
              fontSize: 13,
              background: '#0d1117',
            }}
          >
            {content}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
}
