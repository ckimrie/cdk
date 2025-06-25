module.exports = {
  // Print width - line wrap at 80 characters
  printWidth: 80,
  
  // Tab width - use 2 spaces for indentation
  tabWidth: 2,
  
  // Use spaces instead of tabs
  useTabs: false,
  
  // Add semicolons at the end of statements
  semi: true,
  
  // Use single quotes instead of double quotes
  singleQuote: true,
  
  // Change when properties in objects are quoted
  quoteProps: 'as-needed',
  
  // Use single quotes in JSX
  jsxSingleQuote: true,
  
  // No trailing commas
  trailingComma: 'none',
  
  // Spaces between brackets in object literals
  bracketSpacing: true,
  
  // Put the > of a multi-line JSX element at the end of the last line
  bracketSameLine: false,
  
  // Include parentheses around a sole arrow function parameter
  arrowParens: 'avoid',
  
  // Format only if a file contains a pragma
  requirePragma: false,
  
  // Insert a pragma at the top of formatted files
  insertPragma: false,
  
  // Wrap prose if it exceeds the print width
  proseWrap: 'preserve',
  
  // How to handle whitespaces in HTML
  htmlWhitespaceSensitivity: 'css',
  
  // End of line characters
  endOfLine: 'lf',
  
  // Control whether Prettier formats quoted code embedded in the file
  embeddedLanguageFormatting: 'auto',
  
  // Enforce single attribute per line in HTML, Vue and JSX
  singleAttributePerLine: false,
  
  // Override configuration for specific file types
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 120,
        tabWidth: 2
      }
    },
    {
      files: '*.md',
      options: {
        printWidth: 100,
        proseWrap: 'always'
      }
    },
    {
      files: '*.yml',
      options: {
        tabWidth: 2,
        singleQuote: false
      }
    },
    {
      files: '*.yaml',
      options: {
        tabWidth: 2,
        singleQuote: false
      }
    }
  ]
};