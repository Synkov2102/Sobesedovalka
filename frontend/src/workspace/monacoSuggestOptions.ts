import type { editor } from 'monaco-editor'

/** Editor options that enable rich autocomplete (methods, types, HTML, JSX). */
export const monacoSuggestEditorOptions: editor.IStandaloneEditorConstructionOptions =
  {
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true,
    },
    suggestOnTriggerCharacters: true,
    wordBasedSuggestions: 'matchingDocuments',
    snippetSuggestions: 'inline',
    tabCompletion: 'on',
    parameterHints: { enabled: true },
    suggest: {
      preview: true,
      showMethods: true,
      showFunctions: true,
      showConstructors: true,
      showFields: true,
      showVariables: true,
      showClasses: true,
      showStructs: true,
      showInterfaces: true,
      showModules: true,
      showProperties: true,
      showEvents: true,
      showOperators: true,
      showUnits: true,
      showValues: true,
      showConstants: true,
      showEnums: true,
      showEnumMembers: true,
      showKeywords: true,
      showWords: true,
      showColors: true,
      showFiles: true,
      showReferences: true,
      showFolders: true,
      showTypeParameters: true,
      showSnippets: true,
    },
  }
