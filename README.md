3D Home Planner
A web-based interactive 3D floor planner built with Three.js, TypeScript, and WebGL shaders. 
This application simulates a realistic room with a floor, walls, and ceiling and lets users interactively move furniture, such as the IDANAS drawer from IKEA, within the space.

--Features--

Interactive 3D Scene:
Explore a room with realistic PBR lighting and environment mapping.

Draggable Furniture:
Click to pick up and drag the drawer across the floor, with collision detection/clamping to prevent it from going outside the room boundaries.

Custom Shader Enhancements:
Learn and experiment with GLSL shaders to modify material appearance (e.g., adjusting glossiness) without replacing the full shader code.

Responsive Design:
The scene adjusts dynamically to window resizing.

--Technologies--

Three.js: A powerful 3D library for the web.
TypeScript: Strongly-typed JavaScript for improved code quality.
WebGL Shaders: GLSL-based shader programming for custom visual effects.
GLTFLoader /RGBELoader: Load 3D models and environment maps.

--Installation--

Clone the repository:
git clone https://github.com/yourusername/3d-home-planner.git

Install dependencies:
npm install

Run the development server:
npm run dev

Open your browser:
Navigate to http://localhost:5173
