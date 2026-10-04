// Lightweight synchronous locale bridge for formatting utilities outside React.
let uiLanguage = 'en';
export const getUiLanguage = () => uiLanguage;
export const setUiLanguage = (value) => { uiLanguage = value === 'bn' ? 'bn' : 'en'; };
