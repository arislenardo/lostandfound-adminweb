'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, or } from 'firebase/firestore';
import styles from './modal.module.css';
import msgStyles from './message.module.css';

export default function MessageUserModal({ isOpen, onClose, user, adminUser }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !user || !adminUser) return;

    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', adminUser.uid),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => 
          (m.senderId === adminUser.uid && m.receiverId === user.id) ||
          (m.senderId === user.id && m.receiverId === adminUser.uid)
        );
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [isOpen, user, adminUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'messages'), {
        text: newMessage.trim(),
        senderId: adminUser.uid,
        receiverId: user.id,
        senderName: adminUser.email || 'Admin',
        participants: [adminUser.uid, user.id],
        timestamp: serverTimestamp(),
        isRead: false,
      });
      setNewMessage('');
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modalContent} ${msgStyles.chatModal}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Message: {user.name || user.email || user.id}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={msgStyles.chatWindow}>
          {messages.length === 0 && (
            <p className={msgStyles.emptyChat}>No messages yet. Send the first message below.</p>
          )}
          {messages.map(msg => {
            const isMine = msg.senderId === adminUser?.uid;
            return (
              <div key={msg.id} className={`${msgStyles.bubble} ${isMine ? msgStyles.mine : msgStyles.theirs}`}>
                <p>{msg.text}</p>
                <span className={msgStyles.time}>
                  {msg.timestamp?.toDate ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                </span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className={msgStyles.inputRow}>
          <input
            type="text"
            className={msgStyles.chatInput}
            placeholder="Type a message..."
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button className={msgStyles.sendBtn} onClick={handleSend} disabled={sending}>
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
