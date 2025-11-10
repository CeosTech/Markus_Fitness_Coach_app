import React from 'react';

// A simple markdown parser to render the AI's response in a structured way
// FIX: Rewrote function to use React.createElement instead of JSX syntax, which is not supported in .ts files. This also fixes the return type, resolving errors in components that use this function.
export const renderMarkdown = (text: string): React.ReactNode => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];
    
    const parseInline = (line: string) => {
        // Bold: **text** -> <strong>text</strong>
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
        return React.createElement('span', { dangerouslySetInnerHTML: { __html: line } });
    };

    const flushList = (key: string) => {
        if (listItems.length > 0) {
            elements.push(
                React.createElement('ul', { key, className: "list-disc list-outside space-y-2 pl-5 text-gray-300" },
                    listItems.map((item, i) => React.createElement('li', { key: i }, parseInline(item)))
                )
            );
            listItems = [];
        }
    };

    lines.forEach((line, index) => {
        if (line.startsWith('## ')) {
            flushList(`ul-${index}`);
            elements.push(React.createElement('h4', { key: index, className: "text-lg font-semibold text-indigo-300 mt-5 mb-2" }, parseInline(line.substring(3))));
        } else if (line.startsWith('# ')) {
            flushList(`ul-${index}`);
            elements.push(React.createElement('h3', { key: index, className: "text-xl font-bold text-white mt-6 mb-3 border-b border-gray-700 pb-2" }, parseInline(line.substring(2))));
        } else if (line.startsWith('* ') || line.startsWith('- ')) {
            listItems.push(line.substring(2));
        } else if (line.trim() !== ''){
            flushList(`ul-${index}`);
            elements.push(React.createElement('p', { key: index, className: "text-gray-300 leading-relaxed" }, parseInline(line)));
        }
    });

    flushList('ul-end'); // Flush any remaining list items

    return React.createElement('div', { className: "space-y-4" }, elements);
};