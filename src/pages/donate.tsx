import { Page, Block, Card, Button, Navbar, Toast } from 'konsta/react';
import { useState } from 'react';
import { FaHeart, FaBitcoin, FaEthereum } from 'react-icons/fa';
import { SiMonero } from 'react-icons/si';
import TabbarComponent from '../components/tabbar';

export default function DonateComp() {
    const [toastOpen, setToastOpen] = useState(false);
    const [copiedAddress, setCopiedAddress] = useState('');

    const cryptoAddresses = [
        {
            name: 'Monero',
            address: '4286wRYWcg7hxjvWGpe8b1UeUeHRcEVqzhTmUg4595J4VXyVFGKQyPyAaumXkxprcBZ6M1n1qHL425aKA3agM7cdDuWuFHj',
            icon: <SiMonero className="w-6 h-6" />,
            color: 'bg-[#FF6600]'
        },
        {
            name: 'Bitcoin',
            address: 'bc1qhsc8h059lkdhlha8hylusq6rtnv057afe5dsst',
            icon: <FaBitcoin className="w-6 h-6" />,
            color: 'bg-[#F7931A]'
        },
        {
            name: 'Ethereum',
            address: '0x764B16d0F86183776FbBBdE82C789550912c39b9',
            icon: <FaEthereum className="w-6 h-6" />,
            color: 'bg-[#627EEA]'
        }
    ];

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        //setCopiedAddress(text);
        setToastOpen(true);
        setTimeout(() => setToastOpen(false), 2000);
    };

    return (
        <Page>
            <Navbar title="Support Development" className="text-center" />

            <Block className="">
                <div className="flex flex-col items-center gap-4 mb-2">
                    <img
                        src="/letscage_logo.svg"
                        alt="LetsCage Logo"
                        className="w-16 h-16"
                    />
                    <h1 className="text-2xl font-bold text-center">
                        Support Let's Cage Development
                    </h1>
                    <p className="text-center text-gray-600 max-w-xs">
                        Help us keep Let's Cage free and secure for everyone
                    </p>
                </div>

                <div className="grid gap-4 max-w-lg mx-auto">
                    {cryptoAddresses.map((crypto, index) => (
                        <Card
                            key={index}
                            raised
                            className="overflow-hidden hover:shadow-lg transition-shadow"
                        >
                            <div className={`h-1 ${crypto.color}`} />
                            <div className="p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className={`text-${crypto.color.split('-')[1]}`}>
                                        {crypto.icon}
                                    </span>
                                    <h3 className="text-lg font-bold">{crypto.name}</h3>
                                </div>
                                <div className="bg-gray-50 rounded p-2 mb-3">
                                    <p className="font-mono text-sm break-all">{crypto.address}</p>
                                </div>
                                <Button
                                    onClick={() => copyToClipboard(crypto.address)}
                                    className={`w-full transition-colors ${copiedAddress === crypto.address
                                        ? 'bg-green-500'
                                        : crypto.color
                                        }`}
                                >
                                    {copiedAddress === crypto.address ? 'Copied!' : 'Copy Address'}
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            </Block>

            <Toast
                position="center"
                opened={toastOpen}
                button={<Button clear>OK</Button>}
            >
                Address copied to clipboard!
            </Toast>

            <TabbarComponent />
        </Page>
    );
}