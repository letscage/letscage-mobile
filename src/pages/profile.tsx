import {
    Page,
    Navbar,
    Block,
    Button
} from 'konsta/react';
import QRCode from 'react-qr-code';
import TabbarComponent from '../components/tabbar';
import { writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { profileAtom } from '../state/app_state';
import { useAtom } from 'jotai';

export default function ProfileComp() {
    const [profile, setProfile] = useAtom(profileAtom);

    const downloadQR = async () => {
        try {
            const svg = document.getElementById("QRCode");
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = new Image();

            await new Promise((resolve, reject) => {
                img.onload = async () => {
                    try {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx?.drawImage(img, 0, 0);

                        // Get base64 data and convert to Uint8Array
                        const base64Data = canvas.toDataURL("image/png")
                            .replace(/^data:image\/png;base64,/, "");
                        const binaryData = atob(base64Data);
                        const bytes = new Uint8Array(binaryData.length);

                        for (let i = 0; i < binaryData.length; i++) {
                            bytes[i] = binaryData.charCodeAt(i);
                        }

                        // Write binary data to file
                        await writeFile(
                            `qr-code-${Date.now()}.png`,
                            bytes,
                            { baseDir: BaseDirectory.Download }
                        );

                        resolve(true);
                    } catch (err) {
                        reject(err);
                    }
                };
                img.onerror = reject;
                img.src = "data:image/svg+xml;base64," + btoa(svgData);
            });

            //console.log('QR Code saved to Downloads folder');
        } catch (error) {
            console.error('Failed to save QR code:', error);
        }
    };

    return (
        <Page>
            <Navbar
                title="Profile"
                className="text-center"
            />

            <Block className="flex flex-col items-center justify-center min-h-[80vh]">
                <div className="text-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">
                        Your Onion Address
                    </h2>
                    <p className="text-gray-600 text-sm">
                        Scan this QR code to connect with others
                    </p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-md mb-4">
                    <QRCode
                        id="QRCode"
                        value={profile.currentUser}
                        size={256}
                        level="H"
                    />
                </div>

                <p className="text-gray-600 text-sm mb-4">
                    Or save it for later by clicking the button below
                </p>
                <div className='w-256'>
                    <Button
                        large
                        onClick={downloadQR}
                        className="rounded-lg shadow-md"
                    >
                        Download QR Code
                    </Button>
                </div>
            </Block>

            <TabbarComponent />
        </Page>
    );
}