const API_BASE_URL = "http://127.0.0.1:8000";

export async function getHealth() {
    const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
    return res.json();
}

export async function getAgentStatus() {
    const res = await fetch(`${API_BASE_URL}/agents/status`, {
        cache: "no-store",
    });
    return res.json();
}

export async function getCurrentOutputs() {
    const res = await fetch(`${API_BASE_URL}/outputs/current`, {
        cache: "no-store",
    });
    return res.json();
}

export async function getRuns() {
    const res = await fetch(`${API_BASE_URL}/runs`, { cache: "no-store" });
    return res.json();
}

export async function getErrors() {
    const res = await fetch(`${API_BASE_URL}/errors`, { cache: "no-store" });
    return res.json();
}

export async function getShortTermMemory() {
    const res = await fetch(`${API_BASE_URL}/memory/short-term`, {
        cache: "no-store",
    });
    return res.json();
}

export async function getLongTermMemory() {
    const res = await fetch(`${API_BASE_URL}/memory/long-term`, {
        cache: "no-store",
    });
    return res.json();
}

export async function getCurrentOutputsWithContent() {
    const res = await fetch(`${API_BASE_URL}/outputs/current/with-content`, {
        cache: "no-store",
    });
    return res.json();
}

export async function getControlStatus() {
    const res = await fetch(`${API_BASE_URL}/control/status`, {
        cache: "no-store",
    });
    return res.json();
}

export async function startAgents() {
    const res = await fetch(`${API_BASE_URL}/control/start`, {
        method: "POST",
    });
    return res.json();
}

export async function resumeAgents() {
    const res = await fetch(`${API_BASE_URL}/control/resume`, {
        method: "POST",
    });
    return res.json();
}

export async function archiveRun() {
    const res = await fetch(`${API_BASE_URL}/control/archive`, {
        method: "POST",
    });
    return res.json();
}

export async function scanMemory() {
    const res = await fetch(`${API_BASE_URL}/control/scan-memory`, {
        method: "POST",
    });
    return res.json();
}

export async function getControlLogs() {
    const res = await fetch(`${API_BASE_URL}/control/logs`, {
        cache: "no-store",
    });
    return res.json();
}

export async function stopAgents() {
    const res = await fetch(`${API_BASE_URL}/control/stop`, {
        method: "POST",
    });
    return res.json();
}
export async function sendAgentChat(payload: {
    agent: string;
    provider: string;
    model: string;
    message: string;
    file_name?: string;
    file_content?: string;
    session_id?: number | null;
}) {
    const res = await fetch(`${API_BASE_URL}/chat/send`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    return res.json();
}




export async function getChatSessions() {
    const res = await fetch(`${API_BASE_URL}/chat/sessions`, {
        cache: "no-store",
    });

    return res.json();
}

export async function getChatHistory(sessionId: number) {
    const res = await fetch(`${API_BASE_URL}/chat/history/${sessionId}`, {
        cache: "no-store",
    });

    return res.json();
}

export async function renameChatSession(sessionId: number, title: string) {
    const res = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}/rename`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
    });

    return res.json();
}

export async function deleteChatSession(sessionId: number) {
    const res = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}`, {
        method: "DELETE",
    });

    return res.json();
}

export async function uploadChatFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE_URL}/chat/upload`, {
        method: "POST",
        body: formData,
    });

    return res.json();
}

export async function uploadUiReferenceImage(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE_URL}/ui/upload-reference`, {
        method: "POST",
        body: formData,
    });

    return res.json();
}

export async function getUiReferenceImages() {
    const res = await fetch(`${API_BASE_URL}/ui/reference-images`, {
        cache: "no-store",
    });

    return res.json();
}

export async function analyzeUiReferenceImage(payload: {
    file_name: string;
    model: string;
    prompt?: string;
}) {
    const res = await fetch(`${API_BASE_URL}/ui/analyze-reference`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    return res.json();
}
export async function getAllGeneratedFiles() {
    const res = await fetch(`${API_BASE_URL}/generated/all`, {
        cache: "no-store",
    });

    return res.json();
}
export async function generatePageCode(payload: {
    page_name: string;
    route_path: string;
    description: string;
    model: string;
}) {
    const res = await fetch(`${API_BASE_URL}/builder/generate-page`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    return res.json();
}
