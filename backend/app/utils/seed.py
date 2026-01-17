"""
Database seeding utility for KEA admin panel.
Imports existing .env configuration into the database on first run.
Tracks initialization state to prevent re-seeding after user customization.
"""

import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import (
    ModelConfig,
    ProviderConfig,
    ProviderSet,
    ProviderSetMember,
    get_app_setting,
    set_app_setting,
)

logger = logging.getLogger(__name__)

# Seed version - increment when adding new default providers
SEED_VERSION = "1.0"

# Provider sets seed version - increment when changing system sets
PROVIDER_SETS_VERSION = "2.0"

# ============================================================================
# System Provider Sets Configuration
# ============================================================================

# OpenRouter base URL for all free models
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# System provider sets with their OpenRouter models
# These are paid models - they use your OpenRouter API credits
SYSTEM_PROVIDER_SETS = [
    {
        "name": "cloud-ai",
        "display_name": "KEA Prime",
        "description": "Your configured cloud AI providers (Claude, OpenAI, Gemini, etc.)",
        "sort_order": 0,
        "is_cloud_ai": True,  # Special flag - uses existing providers
        "providers": [],  # Populated from existing ProviderConfig entries
    },
    {
        "name": "coding-experts",
        "display_name": "Coding Experts",
        "description": "Specialized models for code generation and analysis",
        "sort_order": 1,
        "providers": [
            {
                "model_id": "qwen/qwen3-coder",
                "display_name": "Qwen3 Coder",
                "icon": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12.604 1.34l1.174 2.075a.18.18 0 0 0 .157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837l-.76 1.3-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77l-1.335 2.34c-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 0 0-.081.05 575.097 575.097 0 0 1-2.705 4.74c-.169.293-.38.363-.725.364l-3.017.002a.537.537 0 0 1-.465-.271l-1.335-2.323a.09.09 0 0 0-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 0 1-.002-.54l1.207-2.12a.198.198 0 0 0 0-.197 550.951 550.951 0 0 1-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965l1.387-2.436c.132-.234.304-.334.584-.335a338.3 338.3 0 0 1 2.589-.001.124.124 0 0 0 .107-.063l2.806-4.895a.488.488 0 0 1 .422-.246l1.583-.006L11.704 1c.341-.003.724.032.9.34zm-3.432.403a.06.06 0 0 0-.052.03L6.254 6.788a.157.157 0 0 1-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 0 0-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 0 1 .096 0l1.424 2.53a.122.122 0 0 0 .107.062l2.763-.02a.04.04 0 0 0 .035-.02.041.041 0 0 0 0-.04l-2.9-5.086a.108.108 0 0 1 0-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 0 0 0-.114L9.225 1.774a.06.06 0 0 0-.053-.031zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 0 1-.05.029.058.058 0 0 1-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012z" fill="url(#A)"/><defs><linearGradient id="A" x1="0%" x2="100%" y1="0%" y2="0%"><stop offset="0%" stop-color="#6336e7" stop-opacity=".84"/><stop offset="100%" stop-color="#6f69f7" stop-opacity=".84"/></linearGradient></defs></svg>',
            },
            {
                "model_id": "mistralai/devstral-2512",
                "display_name": "Devstral",
                "icon": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3.428 3.4h3.429v3.428H3.428V3.4zm13.714 0h3.43v3.428h-3.43V3.4z" fill="gold"/><path d="M3.428 6.828h6.857v3.429H3.429V6.828zm10.286 0h6.857v3.429h-6.857V6.828z" fill="#ffaf00"/><path d="M3.428 10.258h17.144v3.428H3.428v-3.428z" fill="#ff8205"/><path d="M3.428 13.686h3.429v3.428H3.428v-3.428zm6.858 0h3.429v3.428h-3.429v-3.428zm6.856 0h3.43v3.428h-3.43v-3.428z" fill="#fa500f"/><path d="M0 17.114h10.286v3.429H0v-3.429zm13.714 0H24v3.429H13.714v-3.429z" fill="#e10500"/></svg>',
            },
            {
                "model_id": "deepseek/deepseek-v3.2",
                "display_name": "DeepSeek V3.2",
                "icon": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84a3.97 3.97 0 0 0 1.838 3.393c.137.093.172.187.129.323l-.266.833c-.055.179-.137.217-.329.14a5.526 5.526 0 0 1-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 0 0-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428s-1.67.295-2.687.684a3.055 3.055 0 0 1-.465.137 9.597 9.597 0 0 0-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 0 0 1.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763a2.8 2.8 0 0 0 .371.739c.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 0 1 1.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914l.891.677c-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 0 1 .415-.287.302.302 0 0 1 .2.288.306.306 0 0 1-.31.307.303.303 0 0 1-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 0 1-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 0 1 .016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 0 1-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4d6bfe"/></svg>',
            },
            {
                "model_id": "meta-llama/llama-3.3-70b-instruct",
                "display_name": "Llama 3.3 70B",
                "icon": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill="url(#A)"/><path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill="url(#B)"/><path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill="url(#C)"/><path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill="url(#D)"/><path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill="url(#E)"/><path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill="url(#F)"/><path d="M10.78 9.654l-2.454 3.825c-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 0 1-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 0 0-1.227-1.886z" fill="#0082fb"/><path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416l1.175 1.63c.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill="url(#G)"/><path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082fb"/><path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill="url(#H)"/><path d="M23.998 14.15v-.023h-2.292v.022l.006.424c0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91l-.002-.247z" fill="url(#I)"/><path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill="url(#J)"/><path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222a4.1 4.1 0 0 0 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill="url(#K)"/><path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill="url(#L)"/><path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill="url(#M)"/><defs><linearGradient id="A" x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%"><stop offset=".06%" stop-color="#0867df"/><stop offset="45.39%" stop-color="#0668e1"/><stop offset="85.91%" stop-color="#0064e0"/></linearGradient><linearGradient id="B" x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%"><stop offset="13.23%" stop-color="#0064df"/><stop offset="99.88%" stop-color="#0064e0"/></linearGradient><linearGradient id="C" x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%"><stop offset="1.47%" stop-color="#0072ec"/><stop offset="68.81%" stop-color="#0064df"/></linearGradient><linearGradient id="D" x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%"><stop offset="7.31%" stop-color="#007cf6"/><stop offset="99.43%" stop-color="#0072ec"/></linearGradient><linearGradient id="E" x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%"><stop offset="7.31%" stop-color="#007ff9"/><stop offset="100%" stop-color="#007cf6"/></linearGradient><linearGradient id="F" x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%"><stop offset="7.31%" stop-color="#007ff9"/><stop offset="100%" stop-color="#0082fb"/></linearGradient><linearGradient id="G" x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%"><stop offset="27.99%" stop-color="#007ff8"/><stop offset="91.41%" stop-color="#0082fb"/></linearGradient><linearGradient id="H" x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%"><stop offset="0%" stop-color="#0082fb"/><stop offset="99.95%" stop-color="#0081fa"/></linearGradient><linearGradient id="I" x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%"><stop offset="6.19%" stop-color="#0081fa"/><stop offset="100%" stop-color="#0080f9"/></linearGradient><linearGradient id="J" x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%"><stop offset="0%" stop-color="#027af3"/><stop offset="100%" stop-color="#0080f9"/></linearGradient><linearGradient id="K" x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%"><stop offset="0%" stop-color="#0377ef"/><stop offset="99.94%" stop-color="#0279f1"/></linearGradient><linearGradient id="L" x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%"><stop offset=".19%" stop-color="#0471e9"/><stop offset="100%" stop-color="#0377ef"/></linearGradient><linearGradient id="M" x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%"><stop offset="27.65%" stop-color="#0867df"/><stop offset="100%" stop-color="#0471e9"/></linearGradient></defs></svg>',
            },
            {
                "model_id": "anthropic/claude-3.5-haiku",
                "display_name": "Claude 3.5 Haiku",
                "icon": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#d97757"/></svg>',
            },
        ],
    },
    {
        "name": "general-knowledge",
        "display_name": "General Knowledge",
        "description": "Well-rounded models for broad topics and general queries",
        "sort_order": 2,
        "providers": [
            {
                "model_id": "google/gemini-2.0-flash-001",
                "display_name": "Gemini 2.0 Flash",
                "icon": '<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Gemini</title><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"></path><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#lobe-icons-gemini-fill-0)"></path><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#lobe-icons-gemini-fill-1)"></path><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#lobe-icons-gemini-fill-2)"></path><defs><linearGradient gradientUnits="userSpaceOnUse" id="lobe-icons-gemini-fill-0" x1="7" x2="11" y1="15.5" y2="12"><stop stop-color="#08B962"></stop><stop offset="1" stop-color="#08B962" stop-opacity="0"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" id="lobe-icons-gemini-fill-1" x1="8" x2="11.5" y1="5.5" y2="11"><stop stop-color="#F94543"></stop><stop offset="1" stop-color="#F94543" stop-opacity="0"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" id="lobe-icons-gemini-fill-2" x1="3.5" x2="17.5" y1="13.5" y2="12"><stop stop-color="#FABC12"></stop><stop offset=".46" stop-color="#FABC12" stop-opacity="0"></stop></linearGradient></defs></svg>',
            },
            {
                "model_id": "meta-llama/llama-4-maverick",
                "display_name": "Llama 4 Maverick",
                "icon": '<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Meta</title><path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill="url(#lobe-icons-meta-fill-0)"></path><path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill="url(#lobe-icons-meta-fill-1)"></path><path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill="url(#lobe-icons-meta-fill-2)"></path><path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill="url(#lobe-icons-meta-fill-3)"></path><path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill="url(#lobe-icons-meta-fill-4)"></path><path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill="url(#lobe-icons-meta-fill-5)"></path><path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="#0082FB"></path><path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill="url(#lobe-icons-meta-fill-6)"></path><path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082FB"></path><path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill="url(#lobe-icons-meta-fill-7)"></path><path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill="url(#lobe-icons-meta-fill-8)"></path><path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill="url(#lobe-icons-meta-fill-9)"></path><path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill="url(#lobe-icons-meta-fill-10)"></path><path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill="url(#lobe-icons-meta-fill-11)"></path><path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill="url(#lobe-icons-meta-fill-12)"></path><defs><linearGradient id="lobe-icons-meta-fill-0" x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%"><stop offset=".06%" stop-color="#0867DF"></stop><stop offset="45.39%" stop-color="#0668E1"></stop><stop offset="85.91%" stop-color="#0064E0"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-1" x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%"><stop offset="13.23%" stop-color="#0064DF"></stop><stop offset="99.88%" stop-color="#0064E0"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-2" x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%"><stop offset="1.47%" stop-color="#0072EC"></stop><stop offset="68.81%" stop-color="#0064DF"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-3" x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%"><stop offset="7.31%" stop-color="#007CF6"></stop><stop offset="99.43%" stop-color="#0072EC"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-4" x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%"><stop offset="7.31%" stop-color="#007FF9"></stop><stop offset="100%" stop-color="#007CF6"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-5" x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%"><stop offset="7.31%" stop-color="#007FF9"></stop><stop offset="100%" stop-color="#0082FB"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-6" x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%"><stop offset="27.99%" stop-color="#007FF8"></stop><stop offset="91.41%" stop-color="#0082FB"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-7" x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%"><stop offset="0%" stop-color="#0082FB"></stop><stop offset="99.95%" stop-color="#0081FA"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-8" x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%"><stop offset="6.19%" stop-color="#0081FA"></stop><stop offset="100%" stop-color="#0080F9"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-9" x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%"><stop offset="0%" stop-color="#027AF3"></stop><stop offset="100%" stop-color="#0080F9"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-10" x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%"><stop offset="0%" stop-color="#0377EF"></stop><stop offset="99.94%" stop-color="#0279F1"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-11" x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%"><stop offset=".19%" stop-color="#0471E9"></stop><stop offset="100%" stop-color="#0377EF"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-12" x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%"><stop offset="27.65%" stop-color="#0867DF"></stop><stop offset="100%" stop-color="#0471E9"></stop></linearGradient></defs></svg>',
            },
            {
                "model_id": "x-ai/grok-3-mini",
                "display_name": "Grok 3 Mini",
                "icon": '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24"><path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169s-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383L24 .5l-3.301 3.305v-.01L9.267 15.292m-1.644 1.431c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 0 0-1.829-1A8.975 8.975 0 0 0 5.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"/></svg>',
            },
            {
                "model_id": "mistralai/mistral-small-3.1-24b-instruct",
                "display_name": "Mistral Small 3.1",
                "icon": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3.428 3.4h3.429v3.428H3.428V3.4zm13.714 0h3.43v3.428h-3.43V3.4z" fill="gold"/><path d="M3.428 6.828h6.857v3.429H3.429V6.828zm10.286 0h6.857v3.429h-6.857V6.828z" fill="#ffaf00"/><path d="M3.428 10.258h17.144v3.428H3.428v-3.428z" fill="#ff8205"/><path d="M3.428 13.686h3.429v3.428H3.428v-3.428zm6.858 0h3.429v3.428h-3.429v-3.428zm6.856 0h3.43v3.428h-3.43v-3.428z" fill="#fa500f"/><path d="M0 17.114h10.286v3.429H0v-3.429zm13.714 0H24v3.429H13.714v-3.429z" fill="#e10500"/></svg>',
            },
            {
                "model_id": "qwen/qwen-turbo",
                "display_name": "Qwen Turbo",
                "icon": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12.604 1.34l1.174 2.075a.18.18 0 0 0 .157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837l-.76 1.3-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77l-1.335 2.34c-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 0 0-.081.05 575.097 575.097 0 0 1-2.705 4.74c-.169.293-.38.363-.725.364l-3.017.002a.537.537 0 0 1-.465-.271l-1.335-2.323a.09.09 0 0 0-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 0 1-.002-.54l1.207-2.12a.198.198 0 0 0 0-.197 550.951 550.951 0 0 1-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965l1.387-2.436c.132-.234.304-.334.584-.335a338.3 338.3 0 0 1 2.589-.001.124.124 0 0 0 .107-.063l2.806-4.895a.488.488 0 0 1 .422-.246l1.583-.006L11.704 1c.341-.003.724.032.9.34zm-3.432.403a.06.06 0 0 0-.052.03L6.254 6.788a.157.157 0 0 1-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 0 0-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 0 1 .096 0l1.424 2.53a.122.122 0 0 0 .107.062l2.763-.02a.04.04 0 0 0 .035-.02.041.041 0 0 0 0-.04l-2.9-5.086a.108.108 0 0 1 0-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 0 0 0-.114L9.225 1.774a.06.06 0 0 0-.053-.031zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 0 1-.05.029.058.058 0 0 1-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012z" fill="url(#A)"/><defs><linearGradient id="A" x1="0%" x2="100%" y1="0%" y2="0%"><stop offset="0%" stop-color="#6336e7" stop-opacity=".84"/><stop offset="100%" stop-color="#6f69f7" stop-opacity=".84"/></linearGradient></defs></svg>',
            },
        ],
    },
    {
        "name": "deep-thinking",
        "display_name": "Deep Thinking",
        "description": "Models optimized for reasoning and complex analysis",
        "sort_order": 3,
        "providers": [
            {
                "model_id": "deepseek/deepseek-r1", 
                "display_name": "DeepSeek R1",
                "icon": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84a3.97 3.97 0 0 0 1.838 3.393c.137.093.172.187.129.323l-.266.833c-.055.179-.137.217-.329.14a5.526 5.526 0 0 1-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 0 0-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428s-1.67.295-2.687.684a3.055 3.055 0 0 1-.465.137 9.597 9.597 0 0 0-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 0 0 1.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763a2.8 2.8 0 0 0 .371.739c.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 0 1 1.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914l.891.677c-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 0 1 .415-.287.302.302 0 0 1 .2.288.306.306 0 0 1-.31.307.303.303 0 0 1-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 0 1-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 0 1 .016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 0 1-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4d6bfe"/></svg>',
            },
            {
                "model_id": "qwen/qwq-32b", 
                "display_name": "QwQ 32B",
                "icon": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12.604 1.34l1.174 2.075a.18.18 0 0 0 .157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837l-.76 1.3-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77l-1.335 2.34c-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 0 0-.081.05 575.097 575.097 0 0 1-2.705 4.74c-.169.293-.38.363-.725.364l-3.017.002a.537.537 0 0 1-.465-.271l-1.335-2.323a.09.09 0 0 0-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 0 1-.002-.54l1.207-2.12a.198.198 0 0 0 0-.197 550.951 550.951 0 0 1-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965l1.387-2.436c.132-.234.304-.334.584-.335a338.3 338.3 0 0 1 2.589-.001.124.124 0 0 0 .107-.063l2.806-4.895a.488.488 0 0 1 .422-.246l1.583-.006L11.704 1c.341-.003.724.032.9.34zm-3.432.403a.06.06 0 0 0-.052.03L6.254 6.788a.157.157 0 0 1-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 0 0-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 0 1 .096 0l1.424 2.53a.122.122 0 0 0 .107.062l2.763-.02a.04.04 0 0 0 .035-.02.041.041 0 0 0 0-.04l-2.9-5.086a.108.108 0 0 1 0-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 0 0 0-.114L9.225 1.774a.06.06 0 0 0-.053-.031zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 0 1-.05.029.058.058 0 0 1-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012z" fill="url(#A)"/><defs><linearGradient id="A" x1="0%" x2="100%" y1="0%" y2="0%"><stop offset="0%" stop-color="#6336e7" stop-opacity=".84"/><stop offset="100%" stop-color="#6f69f7" stop-opacity=".84"/></linearGradient></defs></svg>',
            },
            {
                "model_id": "openai/o4-mini", 
                "display_name": "O4 Mini",
                "icon": '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24"><path d="M21.55 10.004a5.416 5.416 0 0 0-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0 0 10.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 0 0 1.76 7.496a5.487 5.487 0 0 0 .691 6.5 5.416 5.416 0 0 0 .477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0 0 13.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 0 0 3.715-2.66 5.488 5.488 0 0 0-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 0 1-2.675-.954l.132-.074 4.44-2.53a.71.71 0 0 0 .364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 0 1-.498-2.763l.131.078 4.44 2.53a.73.73 0 0 0 .73 0l5.42-3.088v2.138a.068.068 0 0 1-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 0 1 5.198 6.41l-.002.151v5.06a.711.711 0 0 0 .364.624l5.42 3.087-1.876 1.07a.067.067 0 0 1-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 0 1 .063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 0 1-2.174 1.807V12.38a.71.71 0 0 0-.363-.623zm1.867-2.773a6.04 6.04 0 0 0-.132-.078l-4.44-2.53a.731.731 0 0 0-.729 0l-5.42 3.088V7.325a.068.068 0 0 1 .027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 0 1-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12a4.21 4.21 0 0 1 2.671.954l-.131.073-4.44 2.53a.71.71 0 0 0-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"/></svg>',
            },
            {
                "model_id": "allenai/olmo-3.1-32b-think", 
                "display_name": "OLMo 3.1 Think",
                "icon": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9.553 9.378H4.777V4.835H8.62c.513 0 .932-.42.932-.932V.058h4.544v4.777a4.542 4.542 0 01-4.544 4.543zm-4.776.467H0v4.543h3.845c.512 0 .932.42.932.932v3.845H9.32v-4.777a4.542 4.542 0 00-4.543-4.543zM20.05 9.61a.935.935 0 01-.932-.932V4.835h-4.543V9.61a4.542 4.542 0 004.543 4.544h4.777V9.612H20.05zM9.787 19.166v4.777h4.544v-3.845c0-.513.42-.932.932-.932h3.845V14.62H14.33a4.542 4.542 0 00-4.544 4.544z" fill="#f0529c"/></svg>',
            },
            {
                "model_id": "baidu/ernie-4.5-21b-a3b-thinking", 
                "display_name": "ERNIE 4.5 Think",
                "icon": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8.859 11.735c1.017-1.71 4.059-3.083 6.202.286 1.579 2.284 4.284 4.397 4.284 4.397s2.027 1.601.73 4.684c-1.24 2.956-5.64 1.607-6.005 1.49l-.024-.009s-1.746-.568-3.776-.112-3.773.286-3.773.286l-.045-.001c-.328-.01-2.38-.187-3.001-2.968-.675-3.028 2.365-4.687 2.592-4.968.226-.288 1.802-1.37 2.816-3.085zm.986 1.738v2.032h-1.64s-1.64.138-2.213 2.014c-.2 1.252.177 1.99.242 2.148s.596 1.073 1.927 1.342h3.078v-7.514l-1.394-.022zm3.588 2.191l-1.44.024v3.956s.064.985 1.44 1.344h3.541v-5.3h-1.528v3.979h-1.46s-.466-.068-.553-.447v-3.556zM9.82 16.715v3.06H8.58s-.863-.045-1.126-1.049c-.136-.445.02-.959.088-1.16.063-.203.353-.671.951-.85H9.82zm9.525-9.036c2.086 0 2.646 2.06 2.646 2.742 0 .688.284 3.597-2.309 3.655s-2.704-1.77-2.704-3.08c0-1.374.277-3.317 2.367-3.317zM4.24 6.08c1.523-.135 2.645 1.55 2.762 2.513.07.625.393 3.486-1.975 4s-3.244-2.249-2.984-3.544c0 0 .28-2.797 2.197-2.969zm8.847-1.483c.14-1.31 1.69-3.316 2.931-3.028 1.236.285 2.367 1.944 2.137 3.37-.224 1.428-1.345 3.313-3.095 3.082s-2.143-1.823-1.973-3.424zM9.425 1c1.307 0 2.364 1.519 2.364 3.398s-1.057 3.4-2.364 3.4-2.367-1.521-2.367-3.4S8.118 1 9.425 1z" fill="#2932e1"/></svg>',
            },
        ],
    },
]


# Provider configurations - model defaults come from settings (single source of truth)
PROVIDER_DEFAULTS = [
    {
        "name": "claude",
        "provider_type": "anthropic",
        "display_name": "Claude",
        "api_key_setting": "anthropic_api_key",
        "model_setting": "claude_model",
    },
    {
        "name": "openai",
        "provider_type": "openai",
        "display_name": "OpenAI",
        "api_key_setting": "openai_api_key",
        "model_setting": "openai_model",
    },
    {
        "name": "gemini",
        "provider_type": "google",
        "display_name": "Gemini",
        "api_key_setting": "google_api_key",
        "model_setting": "gemini_model",
    },
    {
        "name": "mistral",
        "provider_type": "mistral",
        "display_name": "Mistral",
        "api_key_setting": "mistral_api_key",
        "model_setting": "mistral_model",
    },
    {
        "name": "grok",
        "provider_type": "xai",
        "display_name": "Grok",
        "api_key_setting": "xai_api_key",
        "model_setting": "grok_model",
    },
]


async def seed_from_env(session: AsyncSession) -> dict:
    """
    Seed the database with providers from .env configuration.
    Uses initialization tracking to prevent re-seeding after user customization.

    Returns:
        dict: Summary of seeding operation
    """
    # Check if database is already initialized
    is_initialized = await get_app_setting(session, 'db_initialized', False)
    if is_initialized:
        return {"status": "skipped", "message": "Database already initialized"}

    # Get list of defaults user explicitly deleted (empty on first run)
    deleted_defaults = await get_app_setting(session, 'deleted_defaults', [])

    providers_created = 0
    models_created = 0

    for provider_def in PROVIDER_DEFAULTS:
        # Skip if user previously deleted this default provider
        if provider_def["name"] in deleted_defaults:
            continue

        # Get API key from settings
        api_key = getattr(settings, provider_def["api_key_setting"], None)

        # Only create provider if API key is configured
        if not api_key:
            continue

        # Get model from settings (settings has defaults defined)
        model_id = getattr(settings, provider_def["model_setting"])

        # Create provider
        provider = ProviderConfig(
            name=provider_def["name"],
            provider_type=provider_def["provider_type"],
            display_name=provider_def["display_name"],
            api_key=api_key,
            base_url=None,
            is_active=True,
        )
        session.add(provider)
        await session.flush()  # Get the provider ID
        providers_created += 1

        # Create default model
        model = ModelConfig(
            provider_id=provider.id,
            model_id=model_id,
            display_name=model_id,
            is_active=True,
            is_default=True,
        )
        session.add(model)
        models_created += 1

    # Mark database as initialized
    await set_app_setting(session, 'db_initialized', True)
    await set_app_setting(session, 'seed_version', SEED_VERSION)

    await session.commit()

    return {
        "status": "success",
        "providers_created": providers_created,
        "models_created": models_created,
        "seed_version": SEED_VERSION,
    }


async def get_seeding_status(session: AsyncSession) -> dict:
    """Get the current seeding status."""
    from sqlalchemy import func

    # Count providers
    provider_count = await session.execute(
        select(func.count()).select_from(ProviderConfig)
    )
    providers = provider_count.scalar()

    # Count models
    model_count = await session.execute(select(func.count()).select_from(ModelConfig))
    models = model_count.scalar()

    # Get initialization state
    is_initialized = await get_app_setting(session, 'db_initialized', False)
    seed_version = await get_app_setting(session, 'seed_version', None)
    deleted_defaults = await get_app_setting(session, 'deleted_defaults', [])

    return {
        "providers_count": providers,
        "models_count": models,
        "is_seeded": providers > 0,
        "is_initialized": is_initialized,
        "seed_version": seed_version,
        "deleted_defaults": deleted_defaults,
    }


async def migrate_existing_db(session: AsyncSession) -> dict:
    """
    One-time migration for existing databases without initialization tracking.
    Marks the database as initialized if providers already exist.

    Returns:
        dict: Migration status
    """
    is_initialized = await get_app_setting(session, 'db_initialized', None)

    if is_initialized is not None:
        # Already has initialization tracking
        return {"status": "skipped", "message": "Already has initialization tracking"}

    # Check if providers exist
    stmt = select(ProviderConfig).limit(1)
    result = await session.execute(stmt)
    has_providers = result.scalar_one_or_none() is not None

    if has_providers:
        # Mark as initialized to prevent re-seeding
        await set_app_setting(session, 'db_initialized', True)
        await set_app_setting(session, 'seed_version', SEED_VERSION)
        await set_app_setting(session, 'deleted_defaults', [])
        await session.commit()
        return {"status": "migrated", "message": "Marked existing database as initialized"}

    return {"status": "skipped", "message": "No existing data to migrate"}


def get_default_provider_names() -> list[str]:
    """Get list of default provider names for checking during deletion."""
    return [p["name"] for p in PROVIDER_DEFAULTS]


# ============================================================================
# Provider Sets Seeding
# ============================================================================


async def seed_provider_sets(session: AsyncSession) -> dict:
    """
    Seed/update system provider sets on startup.
    - Creates sets if they don't exist
    - Updates provider list for system sets (preserving user enable/disable choices)
    - Does NOT modify custom (non-system) sets

    Returns:
        dict: Summary of seeding operation
    """
    sets_created = 0
    sets_updated = 0
    providers_created = 0
    members_created = 0

    for set_def in SYSTEM_PROVIDER_SETS:
        # Check if set already exists
        result = await session.execute(
            select(ProviderSet).where(ProviderSet.name == set_def["name"])
        )
        existing_set = result.scalar_one_or_none()

        if existing_set:
            # Update existing system set
            if existing_set.is_system:
                existing_set.display_name = set_def["display_name"]
                existing_set.description = set_def.get("description")
                existing_set.sort_order = set_def["sort_order"]
                sets_updated += 1

                # Handle Cloud AI set - sync with existing providers
                if set_def.get("is_cloud_ai"):
                    await _sync_cloud_ai_set(session, existing_set)
                else:
                    # Sync OpenRouter providers for this set
                    result = await _sync_openrouter_providers(
                        session, existing_set, set_def["providers"]
                    )
                    providers_created += result["providers_created"]
                    members_created += result["members_created"]
        else:
            # Create new system set
            provider_set = ProviderSet(
                name=set_def["name"],
                display_name=set_def["display_name"],
                description=set_def.get("description"),
                is_system=True,
                is_active=True,
                sort_order=set_def["sort_order"],
            )
            session.add(provider_set)
            await session.flush()
            sets_created += 1

            # Handle Cloud AI set - add existing providers
            if set_def.get("is_cloud_ai"):
                await _sync_cloud_ai_set(session, provider_set)
            else:
                # Create OpenRouter providers for this set
                result = await _sync_openrouter_providers(
                    session, provider_set, set_def["providers"]
                )
                providers_created += result["providers_created"]
                members_created += result["members_created"]

    await set_app_setting(session, 'provider_sets_version', PROVIDER_SETS_VERSION)
    await session.commit()

    return {
        "status": "success",
        "sets_created": sets_created,
        "sets_updated": sets_updated,
        "providers_created": providers_created,
        "members_created": members_created,
    }


async def _sync_cloud_ai_set(session: AsyncSession, provider_set: ProviderSet) -> None:
    """
    Sync the Cloud AI set with all existing non-OpenRouter providers.
    Adds providers that aren't in the set yet, preserves existing members.
    """
    # Get all existing non-OpenRouter providers
    result = await session.execute(
        select(ProviderConfig).where(
            ProviderConfig.provider_type != "openrouter"
        )
    )
    existing_providers = result.scalars().all()

    # Get current set members
    result = await session.execute(
        select(ProviderSetMember).where(ProviderSetMember.set_id == provider_set.id)
    )
    current_members = {m.provider_id: m for m in result.scalars().all()}

    # Add missing providers to the set
    for idx, provider in enumerate(existing_providers):
        if provider.id not in current_members:
            member = ProviderSetMember(
                set_id=provider_set.id,
                provider_id=provider.id,
                is_enabled=True,
                sort_order=idx,
            )
            session.add(member)


async def _sync_openrouter_providers(
    session: AsyncSession,
    provider_set: ProviderSet,
    provider_defs: list[dict],
) -> dict:
    """
    Sync OpenRouter providers for a system set.
    Creates providers if they don't exist, adds them to the set.
    Preserves user enable/disable choices for existing members.

    Returns:
        dict: Count of created providers and members
    """
    providers_created = 0
    members_created = 0

    # Get current set members for this set
    result = await session.execute(
        select(ProviderSetMember).where(ProviderSetMember.set_id == provider_set.id)
    )
    current_members = {m.provider_id: m for m in result.scalars().all()}

    for idx, provider_def in enumerate(provider_defs):
        model_id = provider_def["model_id"]
        display_name = provider_def["display_name"]

        # Use model_id as provider name (unique identifier)
        provider_name = f"openrouter-{model_id.replace('/', '-').replace(':', '-')}"

        # Check if provider already exists
        result = await session.execute(
            select(ProviderConfig).where(ProviderConfig.name == provider_name)
        )
        provider = result.scalar_one_or_none()

        if not provider:
            # Create new OpenRouter provider
            # Use API key from environment if available
            provider = ProviderConfig(
                name=provider_name,
                provider_type="openrouter",
                display_name=display_name,
                api_key=settings.openrouter_api_key,
                base_url=OPENROUTER_BASE_URL,
                icon=provider_def.get("icon"),
                is_active=True,
            )
            session.add(provider)
            await session.flush()
            providers_created += 1

            # Create the model for this provider
            model = ModelConfig(
                provider_id=provider.id,
                model_id=model_id,
                display_name=display_name,
                is_active=True,
                is_default=True,
            )
            session.add(model)
        else:
            # Update existing provider's API key if it changed or was missing
            # This ensures OpenRouter providers get the API key from env
            if settings.openrouter_api_key and provider.api_key != settings.openrouter_api_key:
                provider.api_key = settings.openrouter_api_key

        # Add provider to set if not already a member
        if provider.id not in current_members:
            member = ProviderSetMember(
                set_id=provider_set.id,
                provider_id=provider.id,
                is_enabled=True,
                sort_order=idx,
            )
            session.add(member)
            members_created += 1

    return {
        "providers_created": providers_created,
        "members_created": members_created,
    }


def get_system_set_names() -> list[str]:
    """Get list of system provider set names."""
    return [s["name"] for s in SYSTEM_PROVIDER_SETS]
