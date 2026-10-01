const DEFAULT_MODEL = "gpt-5.6";
const DEFAULT_ORIGIN = "https://amtparami14-maker.github.io";

const SYSTEM_INSTRUCTIONS = `You are the High Tech Auto Assistant for High Tech Auto Car Service in Yangon, Myanmar.

Reply primarily in Burmese, while keeping useful automotive technical terms in English where clearer.

The customer may describe any car symptom in natural language. Do not rely on a fixed keyword list. Understand the symptom and, when needed, ask focused follow-up questions before narrowing possible causes.

Typical diagnostic information that may be useful includes: vehicle make/model/year, engine type, warning lights, DTC codes, when the problem happens, hot/cold condition, RPM behavior, abnormal noises, recent repairs, battery voltage, scan data, and whether the vehicle can still be driven safely.

Never present a suspected cause as a confirmed diagnosis. Prefer a logical diagnostic sequence over random parts replacement.

Safety is important. If the customer reports severe overheating, smoke, fuel leakage, burning smell, brake failure, steering failure, major engine knocking, or another potentially dangerous condition, advise them to stop driving when safe and arrange qualified inspection/towing as appropriate.

Do not give unsafe instructions involving high voltage, fuel systems, airbags, brakes, or other hazardous systems.

Business information:
High Tech Auto Car Service
No. A-40, Taw Win Residence, Taw Win Street, U Wisara Road, (41) Block (Extend), Dagon (North), Yangon, Myanmar.
Phone: 09 941060666 / 09 459907461 / 09 794918438

Be honest about uncertainty. This assistant provides general automotive information and does not replace a physical inspection by a qualified technician.`;

function getOrigin(request) {
    return process.env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
}

function json(data, status, origin) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Vary": "Origin"
        }
    });
}

function cleanMessages(messages) {

    if (!Array.isArray(messages)) {
        return [];
    }

    return messages
        .filter((m) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string"
        )
        .slice(-20)
        .map((m) => ({
            role: m.role,
            content: m.content.trim().slice(0, 4000)
        }))
        .filter((m) => m.content.length > 0);
}

function extractText(data) {

    if (
        typeof data?.output_text === "string"
    ) {
        return data.output_text.trim();
    }

    const parts = [];

    for (const item of data?.output || []) {

        for (const content of item?.content || []) {

            if (
                content?.type === "output_text" &&
                typeof content.text === "string"
            ) {
                parts.push(content.text);
            }

        }
    }

    return parts.join("\n").trim();
}

export default async function handler(request) {

    const origin =
        getOrigin(request);

    if (request.method === "OPTIONS") {

        return json(
            { ok: true },
            200,
            origin
        );

    }

    if (request.method !== "POST") {

        return json(
            { error: "Method not allowed." },
            405,
            origin
        );

    }

    const apiKey =
        process.env.OPENAI_API_KEY;

    if (!apiKey) {

        return json(
            {
                error:
                    "OPENAI_API_KEY is not configured on the server."
            },
            500,
            origin
        );

    }

    let body;

    try {

        body =
            await request.json();

    } catch {

        return json(
            { error: "Invalid JSON request." },
            400,
            origin
        );

    }

    const messages =
        cleanMessages(
            body?.messages
        );

    if (!messages.length) {

        return json(
            { error: "Please enter a question." },
            400,
            origin
        );

    }

    try {

        const model =
            process.env.OPENAI_MODEL ||
            DEFAULT_MODEL;

        const response =
            await fetch(
                "https://api.openai.com/v1/responses",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${apiKey}`
                    },

                    body: JSON.stringify({

                        model: model,

                        instructions:
                            SYSTEM_INSTRUCTIONS,

                        input:
                            messages,

                        store:
                            false,

                        max_output_tokens:
                            900

                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            console.error(
                "OpenAI API error:",
                data
            );

            return json(
                {
                    error:
                        data?.error?.message ||
                        "OpenAI API request failed."
                },

                response.status,
                origin
            );

        }

        const reply =
            extractText(data);

        if (!reply) {

            return json(
                {
                    error:
                        "OpenAI returned an empty response."
                },

                502,
                origin
            );

        }

        return json(
            {
                reply,
                model
            },

            200,
            origin
        );

    } catch (error) {

        console.error(
            "AI backend error:",
            error
        );

        return json(
            {
                error:
                    "AI backend connection failed."
            },

            500,
            origin
        );

    }

}
