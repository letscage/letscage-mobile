import { useAtom } from 'jotai'

import {
    Icon,
    Tabbar,
    TabbarLink
} from 'konsta/react';
import { MdEmail, MdToday, MdMonetizationOn, MdOutlinePersonPin } from 'react-icons/md';
//import { invoke } from '@tauri-apps/api/core';
import { activePageAtom, ActivePage, unreadCountAtom } from '../state/app_state';


export default function TabbarComponent() {
    const [page, setPage] = useAtom(activePageAtom);
    const [unreadCount] = useAtom(unreadCountAtom);

    async function setActivePage(page: ActivePage) {
        //console.log('profile click');
        //await invoke('greet',  { name: 'profile' });
        setPage(page);
    }


    return (
        <>
            <Tabbar labels icons className="left-0 bottom-0 fixed">
                <TabbarLink
                    active={page === 'inbox'}
                    icon={
                        <Icon
                            material={<MdEmail className="w-6 h-6" />}
                            badge={unreadCount > 0 ? unreadCount : undefined}
                            badgeColors={{ bg: 'bg-green-500' }}
                        />
                    }
                    label="Inbox"
                    onClick={() => setActivePage('inbox')}
                />
                <TabbarLink
                    active={page === 'profile'}
                    icon={
                        <Icon
                            material={<MdOutlinePersonPin className="w-6 h-6" />}
                        />
                    }
                    label="Profile"
                    onClick={() => setActivePage('profile')}
                />
                <TabbarLink
                    active={page === 'donate'}
                    icon={
                        <Icon
                            material={<MdMonetizationOn className="w-6 h-6" />}
                            badgeColors={{ bg: 'bg-red-500' }}
                        />
                    }
                    label="Donate"
                    onClick={() => setActivePage('donate')}
                />
            </Tabbar>

        </>

    )
}