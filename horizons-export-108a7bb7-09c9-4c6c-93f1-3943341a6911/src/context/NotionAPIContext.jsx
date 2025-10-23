
import React, { createContext, useContext } from 'react';
import * as notionApi from '@/api/notion';

const NotionAPIContext = createContext();

export const useNotionAPI = () => useContext(NotionAPIContext);

export const NotionAPIProvider = ({ children }) => {
  // In a real app, you might initialize the API with credentials here
  const api = { ...notionApi };

  return (
    <NotionAPIContext.Provider value={api}>
      {children}
    </NotionAPIContext.Provider>
  );
};
