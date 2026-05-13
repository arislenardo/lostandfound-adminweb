'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, doc, updateDoc } from 'firebase/firestore';
import { sendNewMessageNotification } from '@/lib/emailService';
import styles from './modal.module.css';
import msgStyles from './message.module.css';

/**
 * Modal component to facilitate direct messaging between an administrator
 * and a specific user. Displays chat history and allows sending new messages.
 * @param {Object} props - Component props.
 * @param {boolean} props.isOpen - Controls the visibility of the modal.
 * @param {Function} props.onClose - Callback to trigger when closing the modal.
 * @param {Object} props.user - The user being messaged.
 * @param {Object} props.adminUser - The currently logged-in administrator.
 * @returns {JSX.Element|null} The rendered message modal or null if closed.
 */
export default function MessageUserModal({ isOpen, onClose, user, adminUser }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !user || !adminUser) return;

    // Query 1: messages sent BY admin TO this user
    const q1 = query(
      collection(db, 'messages'),
      where('senderId', '==', adminUser.uid),
      where('receiverId', '==', user.id),
      orderBy('timestamp', 'asc')
    );

    // Query 2: messages sent BY this user TO admin (Android replies)
    const q2 = query(
      collection(db, 'messages'),
      where('senderId', '==', user.id),
      where('receiverId', '==', adminUser.uid),
      orderBy('timestamp', 'asc')
    );

    let sent = [];
    let received = [];

    /**
     * Helper function to merge and sort sent and received messages by timestamp.
     */
    const merge = () => {
      const combined = [...sent, ...received];
      combined.sort((a, b) => {
        const ta = a.timestamp?.toDate?.() ?? new Date(0);
        const tb = b.timestamp?.toDate?.() ?? new Date(0);
        return ta - tb;
      });
      setMessages(combined);
    };

    const unsub1 = onSnapshot(q1, snap => {
      sent = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      merge();
    });

    const unsub2 = onSnapshot(q2, snap => {
      received = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      merge();

      // Mark any unread messages as read so the notification clears!
      snap.docs.forEach(d => {
        if (d.data().isRead === false) {
          updateDoc(doc(db, 'messages', d.id), { isRead: true }).catch(console.error);
        }
      });
    });

    // Generate deterministic chat ID (matches Android ChatManager logic)
    const sortedIds = [adminUser.uid, user.id].sort();
    const chatId = `${sortedIds[0]}_${sortedIds[1]}`;

    // Query 3: Listen for closed chat status
    const unsubClosed = onSnapshot(doc(db, 'closed_chats', chatId), snap => {
      if (snap.exists()) {
        setIsClosed(snap.data().closed === true);
      } else {
        setIsClosed(false);
      }
    });


    return () => { unsub1(); unsub2(); unsubClosed(); };
  }, [isOpen, user, adminUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Handles sending a new message from the administrator to the user.
   * Also triggers an email notification to the user if they have an email address.
   */
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

      // --- TRIGGER EMAIL NOTIFICATION TO USER ---
      if (user.email) {
        console.log('Attempting to send email to:', user.email);
        const success = await sendNewMessageNotification(
          user.email,
          adminUser.email || 'Official Station Admin',
          newMessage.trim()
        );
        if (!success) {
          alert('Message sent successfully, but EMAIL ALERT FAILED. Check server logs.');
        } else {
          console.log('Email alert triggered successfully.');
        }
      } else {
        console.warn('User has no email registered. Skipping email alert.');
      }
      // ------------------------------------------

      setNewMessage('');
    } catch (e) {
      console.error('Failed to send message:', e);
      alert('Failed to send message: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  /**
   * Concludes the chat session, preventing further replies from either party.
   * Sends a final closing message and marks the session as closed in the database.
   */
  const handleEndSession = async () => {
    if (!window.confirm("End this chat session? This will prevent any further replies from both parties.")) return;

    setSending(true);
    try {
      const sortedIds = [adminUser.uid, user.id].sort();
      const chatId = `${sortedIds[0]}_${sortedIds[1]}`;

      // Send closing message
      await addDoc(collection(db, 'messages'), {
        text: "The session has been concluded. Thank you.",
        senderId: adminUser.uid,
        receiverId: user.id,
        senderName: "Official Station Admin",
        participants: [adminUser.uid, user.id],
        timestamp: serverTimestamp(),
        isRead: false,
      });

      // Mark chat as closed
      await setDoc(doc(db, 'closed_chats', chatId), { closed: true });
    } catch (e) {
      console.error('Failed to end session:', e);
      alert('Failed to end session: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  /**
   * Re-opens the chat session, allowing replies from both parties again.
   */
  const handleUnlockSession = async () => {
    if (!window.confirm("Re-open this chat session? Both parties will be able to reply again.")) return;

    setSending(true);
    try {
      const sortedIds = [adminUser.uid, user.id].sort();
      const chatId = `${sortedIds[0]}_${sortedIds[1]}`;

      // Mark chat as open
      await setDoc(doc(db, 'closed_chats', chatId), { closed: false });

      // Send a system message so the user knows it's open
      await addDoc(collection(db, 'messages'), {
        text: "The session has been re-opened by the administrator.",
        senderId: adminUser.uid,
        receiverId: user.id,
        senderName: "System",
        participants: [adminUser.uid, user.id],
        timestamp: serverTimestamp(),
        isRead: false,
      });

    } catch (e) {
      console.error('Failed to unlock session:', e);
      alert('Failed to unlock session: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modalContent} ${msgStyles.chatModal}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Message: {user.name || user.email || user.id} {isClosed && <span style={{ color: 'var(--error)', fontSize: '0.8rem', marginLeft: '8px' }}>(Closed)</span>}</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!isClosed ? (
              <button
                onClick={handleEndSession}
                className={msgStyles.sendBtn}
                style={{ backgroundColor: 'var(--error)', padding: '4px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                disabled={sending}
              >
                🔒 End Session
              </button>
            ) : (
              <button
                onClick={handleUnlockSession}
                className={msgStyles.sendBtn}
                style={{ backgroundColor: 'var(--success)', padding: '4px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                disabled={sending}
              >
                🔓 Re-open Session
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
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

        {isClosed ? (
          <div className={msgStyles.inputRow} style={{ justifyContent: 'center' }}>
            <p className={msgStyles.emptyChat} style={{ margin: 0, fontStyle: 'italic' }}>This session has been concluded. Replies are disabled.</p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
