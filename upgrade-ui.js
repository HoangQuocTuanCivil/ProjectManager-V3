const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function bumpUI(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 1. Text sizes - use temp placeholders for all classes to avoid chained replacements
  content = content.replace(/text-\[9px\]/g, '__TEMP_10__');
  content = content.replace(/text-\[9\.5px\]/g, '__TEMP_11__');
  content = content.replace(/text-\[10px\]/g, '__TEMP_11__');
  content = content.replace(/text-\[11px\]/g, '__TEMP_XS__');
  content = content.replace(/\btext-xs\b/g, '__TEMP_SM__');
  content = content.replace(/text-\[13px\]/g, '__TEMP_SM__');
  content = content.replace(/\btext-sm\b/g, '__TEMP_BASE__');
  content = content.replace(/text-\[15px\]/g, '__TEMP_BASE__');

  // restore placeholders
  content = content.replace(/__TEMP_10__/g, 'text-[10px]');
  content = content.replace(/__TEMP_11__/g, 'text-[11px]');
  content = content.replace(/__TEMP_XS__/g, 'text-xs');
  content = content.replace(/__TEMP_SM__/g, 'text-sm');
  content = content.replace(/__TEMP_BASE__/g, 'text-base');

  // 2. Icon sizes (Lucide icons typically use size={Number})
  // Let's use placeholders as well to prevent chain replacement
  content = content.replace(/size=\{12\}/g, '__SZ_14__');
  content = content.replace(/size=\{13\}/g, '__SZ_14__');
  content = content.replace(/size=\{14\}/g, '__SZ_16__');
  content = content.replace(/size=\{15\}/g, '__SZ_18__');
  content = content.replace(/size=\{16\}/g, '__SZ_18__');
  content = content.replace(/size=\{17\}/g, '__SZ_20__');

  content = content.replace(/__SZ_14__/g, 'size={14}');
  content = content.replace(/__SZ_16__/g, 'size={16}');
  content = content.replace(/__SZ_18__/g, 'size={18}');
  content = content.replace(/__SZ_20__/g, 'size={20}');

  // 3. Spacing bumps (optional but good for larger text)
  // E.g. h-8 -> h-9 (Inputs), h-7 -> h-8
  content = content.replace(/\bh-7\b/g, '__H_8__');
  content = content.replace(/\bh-8\b/g, '__H_10__'); // h-8 (32px) to h-10 (40px) is standard for inputs

  content = content.replace(/__H_8__/g, 'h-8');
  content = content.replace(/__H_10__/g, 'h-10');

  // Let's also bump button paddings usually paired with these heights
  // px-3 -> px-4 is often good. But let's leave padding alone unless it breaks.

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath.replace(__dirname, '')}`);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      bumpUI(fullPath);
    }
  }
}

console.log("Starting UI Bump...");
walk(srcDir);
console.log("Done.");
