import React, { useEffect, useRef, useState } from 'react';
import {
  Page,
  Navbar,
  NavbarBackLink,
  Messages,
  Message,
  MessagesTitle,
  Messagebar,
  Link,
  Icon,
  Preloader
} from 'konsta/react';
import { MdSend } from 'react-icons/md';
import { useAtom } from 'jotai';
import { activePageAtom, profileAtom, otherUserAtom } from '../state/app_state';
import Database from '@tauri-apps/plugin-sql';
import generateAvatar from "../utils/genavatar";
import { invoke } from '@tauri-apps/api/core';

// Import avatar generator

interface ChatMessage {
  from_user: string;
  to_user: string;
  message_id: string;
  content: string;
  timestamp: string;
  unread: boolean;
}

export default function MessageDetail() {
  const [_, setPage] = useAtom(activePageAtom);
  const [profile, setProfile] = useAtom(profileAtom);
  const [otherUser, setOtherUser] = useAtom(otherUserAtom);
  const [currentUser, setCurrentUser] = useState(profile.currentUser);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Add function to mark messages as read
  const markMessagesAsRead = async () => {
    try {
      const db = await Database.load('sqlite:letscage.db');
      await db.execute(`
                UPDATE messages 
                SET unread = false 
                WHERE from_user = ? 
                AND to_user = ? 
                AND unread = true
            `, [otherUser, currentUser]);
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  // Fetch chat history
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const db = await Database.load('sqlite:letscage.db');
        const result = await db.select<ChatMessage[]>(`
                    SELECT * FROM messages 
                    WHERE (from_user = ? AND to_user = ?)
                    OR (from_user = ? AND to_user = ?)
                    ORDER BY timestamp ASC
                `, [currentUser, otherUser, otherUser, currentUser]);
        //console.log('results are ', result, [currentUser, otherUser, otherUser, currentUser]);
        setMessages(result);

        // Generate avatar for other user
        const avatar = await generateAvatar(otherUser);
        setAvatarUrl(avatar);

        //mark messages as read
        await markMessagesAsRead();

      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };

    fetchMessages();
  }, [currentUser, otherUser]);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message handler
  const handleSendClick = async () => {
    if (!messageText.trim() || isSending) return;

    if (!messageText.trim() || isSending) return;

    setIsSending(true);
    try {
      await invoke('send_message', {
        to: otherUser,
        msg: messageText
      });
      setMessageText('');
    } catch (error) {
      console.error('Failed to send message:', error);
      // Optionally show error toast/notification
    } finally {
      setIsSending(false);
    }

    try {

      const db = await Database.load('sqlite:letscage.db');
      const msg_id = crypto.randomUUID();

      await db.execute(`
                INSERT INTO messages (from_user, to_user, message_id, content, timestamp, unread) 
                VALUES (?, ?, ?, ?, datetime('now'), true)
            `, [currentUser, otherUser, msg_id, messageText]);

      setMessages([...messages, {
        from_user: currentUser,
        to_user: otherUser,
        message_id: msg_id,
        content: messageText,
        timestamp: new Date().toISOString(),
        unread: true
      }]);

      setMessageText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <Page>
      <Navbar
        title={otherUser}
        left={<NavbarBackLink onClick={() => setPage('inbox')} />}
      />
      <div className="h-[calc(100vh-88px)] overflow-y-auto">
        <Messages className="messages-content">
          {messages.map((msg, index) => (
            <Message
              key={msg.message_id}
              type={msg.from_user === currentUser ? 'sent' : 'received'}
              text={<>
                {msg.from_user === currentUser && <span>{msg.content}</span>}
                {msg.from_user !== currentUser && <span className='text-black'>{msg.content}</span>}
              </>}
              avatar={msg.from_user !== currentUser && (
                <img
                  src={avatarUrl}
                  alt="User avatar"
                  className="w-10 h-10 rounded-full"
                />
              )}
            />
          ))}
          <div ref={bottomRef} />
        </Messages>
      </div>
      <Messagebar
        placeholder={isSending ? "Sending..." : "Message"}
        value={messageText}
        onInput={(e) => setMessageText(e.target.value)}
        disabled={isSending}
        right={
          <Link
            onClick={handleSendClick}
            toolbar
            style={{
              opacity: messageText.trim() && !isSending ? 1 : 0.3,
              cursor: messageText.trim() && !isSending ? 'pointer' : 'default',
            }}
          >
            {isSending ? (
              <Preloader size="w-6 h-6" className="animate-spin" />
            ) : (
              <Icon material={<MdSend className="w-6 h-6" />} />
            )}
          </Link>
        }
        colors={{
          placeholderMd: 'text-black'
        }}
      />
    </Page>
  );
}