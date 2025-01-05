import {
    Page,
    Navbar,
    BlockTitle,
    List,
    ListItem,
    Fab,
    Actions,
    ActionsGroup,
    ActionsButton,
} from 'konsta/react';
import TabbarComponent from '../components/tabbar';
import { useAtom } from 'jotai';
import { activePageAtom, otherUserAtom, profileAtom } from '../state/app_state';
import { useEffect, useState } from 'react';
import Database from '@tauri-apps/plugin-sql';
import { MdAdd } from 'react-icons/md';
import generateAvatar from "../utils/genavatar";
import jsQR from 'jsqr';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { Message, messagesAtom } from '../state/app_state';

interface AvatarCache {
    [key: string]: string;
}



export default function MessageList() {
    const [_, setPage] = useAtom(activePageAtom);
    const [otherUser, setOtherUser] = useAtom(otherUserAtom);
    const [messages, setMessages] = useAtom(messagesAtom);
    const [profile ] = useAtom(profileAtom);

    const [avatarUrls, setAvatarUrls] = useState<AvatarCache>({});
    const [actionsTwoOpened, setActionsTwoOpened] = useState(false);
    const [isFabVisible, setIsFabVisible] = useState(true);
    const fetchMessages = async () => {
        try {
            const db = await Database.load('sqlite:letscage.db');
            //                console.log('Database loaded');

            const result = await db.select<Message[]>(`
                WITH RankedMessages AS (
                    SELECT *,
                        ROW_NUMBER() OVER (
                            PARTITION BY from_user 
                            ORDER BY timestamp DESC
                        ) as rn
                    FROM messages
                )
                SELECT 
                    from_user,
                    to_user,
                    message_id,
                    content,
                    timestamp,
                    unread
                FROM RankedMessages 
                WHERE rn = 1
                ORDER BY timestamp DESC
            `);

            //console.log('Latest messages by user:', result);
            setMessages(result);
        } catch (error) {
            console.error('Database error:', error);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, []);

    // fetch messages every 1 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchMessages();
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        //console.log('Current messages:', messages);
        messages.forEach(async (message) => {
            if (!avatarUrls[message.from_user]) {
                const avatarUrl = await generateAvatar(message.from_user);
                setAvatarUrls(prev => ({
                    ...prev,
                    [message.from_user]: avatarUrl
                }));
            }
        });
    }, [messages]);

    const is_message_unread = (m: Message): boolean => {
        if (!m) return false;
        return m.unread === 1 && m.from_user != profile.currentUser;
    };

    function generate_random_msg_id(): string {
        // Create array for random bytes
        const array = new Uint8Array(16);
        // Fill with random values
        crypto.getRandomValues(array);
        // Convert to hex string
        const randomHex = Array.from(array)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        // Add timestamp prefix
        const timestamp = Date.now().toString(36);
        // Combine timestamp and random hex
        return `${timestamp}-${randomHex}`;
    }

    // Update triggerActions function
    async function triggerActions() {
        setActionsTwoOpened(true);
        setIsFabVisible(false);
    }

    // Add handler for Actions close
    const handleActionsClose = () => {
        setActionsTwoOpened(false);
        setIsFabVisible(true);
    };

    async function upload_qr_code() {
        try {
            // Open file dialog
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Image',
                    extensions: ['png', 'jpg', 'jpeg']
                }]
            });

            if (!selected) return;

            // Read file
            const imageData = await readFile(selected as string);

            // Convert to image data
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            await new Promise((resolve, reject) => {
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx?.drawImage(img, 0, 0);
                    resolve(true);
                };
                img.onerror = reject;
                img.src = URL.createObjectURL(new Blob([imageData]));
            });

            // Get image data for QR processing
            const imageDataFromCanvas = ctx?.getImageData(0, 0, canvas.width, canvas.height);

            if (!imageDataFromCanvas) {
                throw new Error('Failed to get image data');
            }

            // Decode QR code
            const code = jsQR(
                imageDataFromCanvas.data,
                imageDataFromCanvas.width,
                imageDataFromCanvas.height
            );

            if (code) {
                // Extract onion address from QR code
                const onionAddress = code.data;
                //console.log('qr code is ', onionAddress);
                handleActionsClose();
                if (onionAddress == otherUser) {
                    console.log('Same user, no need to chat');
                } else {
                    setOtherUser(onionAddress);
                    setPage('message_detail');
                }

                //setOtherUser(onionAddress);
                //setPage('message_detail');
            } else {
                throw new Error('No QR code found in image');
            }

        } catch (error) {
            console.error('Failed to process QR code:', error);
        }
    }


    return (
        <Page>
            <Navbar title="Messages" />
            {/* Center Bottom */}
            {isFabVisible && (
                <Fab
                    className="fixed left-1/2 bottom-32 transform -translate-x-1/2 z-50"
                    icon={<MdAdd />}
                    text="New Message"
                    textPosition="after"
                    onClick={triggerActions}
                />
            )}

            <BlockTitle>Messages</BlockTitle>
            <List strongIos outlineIos>
                {messages.map((message) => (
                    <ListItem
                        key={message.message_id}
                        link
                        chevronMaterial={false}
                        title={
                            <div className="truncate max-w-[200px]">
                                {message.from_user}
                            </div>
                        }
                        subtitle={
                            <div className="truncate text-sm text-gray-500">
                                {new Date(message.timestamp).toLocaleString()}
                            </div>
                        }
                        text={
                            <div className="line-clamp-2 text-sm text-gray-600">
                                {message.content}
                            </div>
                        }
                        after={is_message_unread(message) ? "New" : ""}
                        media={
                            <img
                                className="ios:rounded-lg material:rounded-full ios:w-20 material:w-10 object-cover"
                                src={avatarUrls[message.from_user] || 'placeholder.png'}
                                width="80"
                                alt="user avatar"
                            />
                        }
                        strongTitle={is_message_unread(message)}
                        className={`${is_message_unread(message) ? 'font-semibold' : ''} overflow-hidden`}
                        onClick={() => {
                            setOtherUser(message.from_user)
                            setPage('message_detail');
                        }}
                    />
                ))}
            </List>
            <TabbarComponent />
            <Actions
                opened={actionsTwoOpened}
                onBackdropClick={handleActionsClose}
            >
                <ActionsGroup>
                    <ActionsButton onClick={handleActionsClose} bold>
                        Scan QR code via camera
                    </ActionsButton>
                    <ActionsButton onClick={upload_qr_code}>
                        Upload QR code image
                    </ActionsButton>
                </ActionsGroup>
                <ActionsGroup>
                    <ActionsButton onClick={handleActionsClose}>
                        Cancel
                    </ActionsButton>
                </ActionsGroup>
            </Actions>
        </Page>
    )
}