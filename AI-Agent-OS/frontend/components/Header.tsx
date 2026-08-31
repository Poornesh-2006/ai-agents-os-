export default function Header() {
    return (
        <header className="fixed left-64 right-0 top-0 z-10 border-b border-white/10 bg-slate-950/90 px-8 py-4 text-white backdrop-blur">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Local AI Agent Operating System</h2>
                    <p className="text-xs text-gray-500">
                        Read-only monitoring mode
                    </p>
                </div>

                <div className="rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2 text-sm text-green-300">
                    API Online
                </div>
            </div>
        </header>
    );
}

