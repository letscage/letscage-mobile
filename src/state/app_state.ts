import { atom } from 'jotai'

export interface Message {
    from_user: string;
    to_user: string;
    message_id: string;
    content: string;
    timestamp: string;
    unread: number;
}
export const messagesAtom = atom<Message[]>([]);
export const unreadMessagesAtom = atom((get) => {
    const messages = get(messagesAtom);
    const profile = get(profileAtom);
    return messages.filter(msg => 
        msg.unread === 1 && 
        msg.from_user !== profile.currentUser
    );
});
export const unreadCountAtom = atom((get) => {
    const unreadMessages = get(unreadMessagesAtom);
    return unreadMessages.length;
});


export type ActivePage = 'inbox' | 'profile' | 'donate' | 'message_detail';
export interface Profile {
    currentUser: string;
    // Add more profile fields here as needed
}

export const activePageAtom = atom<ActivePage>('inbox');
//fix it
export const profileAtom = atom<Profile>({
    currentUser: 'nmcywxh2pv3lwzf3fwxwq7aq5klpzcuicmzaul4mjyvtvst4ajwz42qd.onion'
});

export const otherUserAtom = atom<string>('');
