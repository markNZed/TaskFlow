import React from 'react';
import { QueryClientProvider, QueryClient } from 'react-query'; 
import { ReactQueryDevtools } from 'react-query/devtools'
import './styles/App.css';
import './styles/normal.css';
import ChatArea from "./components/ChatArea"
import SideMenu from "./components/SideMenu"
import { ModelProvider } from './contexts/ModelContext';

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>

      <ModelProvider>
        <div className="App">
          <SideMenu/>
          <ChatArea/>
        </div>
      </ModelProvider>

      <ReactQueryDevtools 
      initialIsOpen={false}
      position='top-right'
      />

   </QueryClientProvider>
    
  );
}

export default App;
