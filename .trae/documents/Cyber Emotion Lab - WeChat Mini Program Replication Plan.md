Based on the review of the H5 codebase, here is the detailed plan to create the documentation and the WeChat Mini Program version.

I will use **Taro (React)** for the WeChat Mini Program implementation. This allows us to reuse ~90% of the existing business logic and UI structure while ensuring the "100% perfect replication" requirement is met by leveraging React's component model.

### Phase 1: Documentation (Immediate)
I will create the following two documents in the project root:
1.  **`赛博情绪实验室-产品方案说明书.md` (Product Requirements Document)**
    *   **Core Concept**: "Cyber Emotion Candy" - transforming emotions into visual cards.
    *   **Features**: Template Gallery, AI Polish (DeepSeek), Random Rarity System (N/R/SR/SSR), Currency (Candy), Daily Check-in, Mock Ads, Inventory.
    *   **UI/UX**: Cyberpunk aesthetic, neon effects, holographic tilt interactions.
2.  **`前端技术方案说明书.md` (Technical Specification)**
    *   **Architecture**: React + Tailwind CSS (H5) → Taro + React + Tailwind (WeChat MP).
    *   **Data Flow**: LocalStorage adaptation, API Proxy for DeepSeek (to bypass MP domain restrictions if necessary, or direct call).
    *   **Visuals**: Porting CSS filters, animations, and Canvas effects (Confetti) to Mini Program environment.

### Phase 2: WeChat Mini Program Implementation
I will create a new directory `wechat-mini-program` and implement the following:

#### 1. Project Initialization
*   Initialize a **Taro** project with **React** and **TypeScript**.
*   Configure **Tailwind CSS** support for Taro (using `weave-tailwind` or equivalent preset).

#### 2. Core Logic Migration
*   **Constants & Types**: Copy `types.ts` and `constants.tsx` (Assets, Templates).
*   **State Management**: Port `App.tsx` state (`candyCount`, `history`, `view`) to the main page or global store.
*   **Storage**: Replace `localStorage` with `Taro.setStorageSync/getStorageSync`.

#### 3. UI Component Porting (1:1 Replication)
*   **Components**: Convert HTML tags (`div`, `span`, `img`) to Taro components (`View`, `Text`, `Image`).
    *   `Navbar` & `BottomNav`: Fixed layout adaptation.
    *   `TemplateCard` & `HoloCard`: Reimplement 3D tilt effect using `Taro.createSelectorQuery` or `MovableView`.
    *   `InputOverlay`: Handle keyboard interactions and inputs.
    *   `ResultView`: Rarity animations and "Save to Album" (using `Taro.saveImageToPhotosAlbum`).
*   **Visual Effects**:
    *   Port `Confetti` (Canvas) to WeChat Canvas.
    *   Replicate "Neon Glow", "Glitch", and "Scanline" CSS effects.

#### 4. Feature Adaptation
*   **DeepSeek API**: Use `Taro.request` for the AI Polish feature.
*   **Sharing**: Implement `onShareAppMessage` for the "Share" button.
*   **Ads**: Simulate the "Watch Ad" behavior (or integrate actual MP Ads if IDs provided, otherwise keep Mock).

#### 5. Verification
*   Verify all templates, animations, and the user flow (Home -> Generate -> Result -> History).
