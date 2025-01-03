/* eslint-disable react/no-array-index-key */
import {
  App
} from 'konsta/react';
//import App.css
import './App.css';

import MessageList from './pages/messagelist';
import { useAtom } from 'jotai';
import { activePageAtom } from './state/app_state';
import Donate from './pages/donate';
import Profile from './pages/profile';
import MessageDetail from './pages/messagedetail';

export default function MyApp() {
  const [activePage, _] = useAtom(activePageAtom);
  return (<>
    <App theme="material" dark={false}>
      {activePage === 'inbox' && <MessageList />}
      {activePage === 'profile' && <Profile />}
      {activePage === 'donate' && <Donate />}
      {activePage == 'message_detail' && <MessageDetail />}
    </App>
  </>)
}

MyApp.displayName = 'MessagesPage';