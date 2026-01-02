# System Design Knowledge Base - Documentation Site

Beautiful, searchable documentation site built with [Nextra](https://nextra.site/).

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 2. Run Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
docs-site/
├── pages/              # All documentation pages
│   ├── index.mdx      # Homepage
│   ├── get-started.mdx
│   ├── navigation.md
│   ├── system-design/ # System design articles
│   │   ├── databases/
│   │   ├── caching/
│   │   └── ...
│   └── interview-prep/ # Interview prep articles
├── public/            # Static assets
├── theme.config.jsx   # Nextra theme configuration
├── next.config.mjs    # Next.js configuration
└── package.json
```

## ✨ Features

- ✅ **Full-text search** - Search across all content
- ✅ **Dark/Light mode** - Toggle theme
- ✅ **Mobile responsive** - Works on all devices
- ✅ **Table of contents** - Auto-generated for each page
- ✅ **Syntax highlighting** - Beautiful code blocks
- ✅ **Reading time** - Estimated time for each article
- ✅ **Breadcrumbs** - Easy navigation
- ✅ **Previous/Next** - Navigate between pages
- ✅ **Mermaid diagrams** - Interactive architecture diagrams

## 🎨 Customization

### Theme Configuration

Edit `theme.config.jsx` to customize:
- Logo
- Colors
- Footer
- Banner
- Navigation

### Content Organization

Edit `_meta.json` files in each directory to control:
- Navigation order
- Section titles
- Icons/emojis

## 📝 Adding Content

### Add New Article

1. Create `.md` or `.mdx` file in appropriate directory
2. Add entry to `_meta.json` in that directory
3. Content automatically appears in navigation

### Example

```markdown
---
title: My New Article
---

# My New Article

Content here...
```

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Other Platforms

Build the static site:

```bash
npm run build
```

Deploy the `.next` folder to any static hosting service.

## 🔗 Links

- [Nextra Documentation](https://nextra.site/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Deployment Guide](https://nextra.site/docs/guide/deploy)

## 📊 Features Overview

### Search
Press `Cmd/Ctrl + K` to open search

### Navigation
- Sidebar automatically generated from folder structure
- Collapsible sections
- Difficulty badges (🟢🟡🔴)

### Code Blocks
```javascript
// Automatic syntax highlighting
const example = "Hello World";
```

### Callouts
Use Nextra components for callouts, cards, tabs, and more.

## 💡 Tips

- Use `.mdx` for pages with React components
- Use `.md` for simple markdown content
- Mermaid diagrams work automatically
- All markdown files are symlinked from parent directory

## 🐛 Troubleshooting

**Search not working?**
- Rebuild the search index: `rm -rf .next && npm run dev`

**Styles not loading?**
- Clear Next.js cache: `rm -rf .next`

**Links broken?**
- Check `_meta.json` file paths
- Ensure symbolic links are correct

## 📝 License

MIT License - feel free to use for your own documentation!
