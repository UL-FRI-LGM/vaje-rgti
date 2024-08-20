# Ogrodje

Za lažji razvoj bomo v tej vaji uporabili ogrodje iz repozitorija
[webgpu-examples](https://github.com/UL-FRI-LGM/webgpu-examples).
Aplikacijo bomo napisali od začetka, zato datotek s prejšnjih vaj ne
potrebujemo. Ogrodje je na voljo v direktoriju `engine`, ki ga skopiramo
v svojo aplikacijo, prav tako direktorij `models`. Skopiramo tudi direktorij
`lib`, ki vsebuje knjižnice.

### Priprava aplikacije

Zdaj ustvarimo glavni datoteki aplikacije. Najprej `index.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Vaja 5</title>
    {
        "imports": {
            "engine/": "./engine/",
            "dat": "./lib/dat.js",
            "glm": "./lib/glm.js"
        }
    }
    </script>
    <link rel="stylesheet" href="engine/style.css">
    <script type="module" src="main.js"></script>
</head>
<body>
    <div class="fullscreen no-touch pixelated">
        <canvas></canvas>
    </div>
</body>
</html>
```

Tako zgrajen HTML bo poskrbel tudi za razteg platna čez celoten zaslon in za
pravilno uvažanje modulov.

Nato ustvarimo še `main.js`, kjer postavimo osnovno ogrodje aplikacije in
uvozimo vse potrebne razrede:

```js
import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';

import {
    Camera,
    Model,
    Node,
    Transform,
} from 'engine/core.js';

const canvas = document.querySelector('canvas');

function update(time, dt) {}
function render() {}
function resize({ displaySize: { width, height }}) {}

new ResizeSystem({ canvas, resize }).start();
new UpdateSystem({ update, render }).start();
```

### Branje scene iz datoteke

Prebrali bomo sceno iz datoteke `./models/monkey/monkey.gltf`.
Scena je opisana v formatu glTF, ki vsebuje vse informacije o grafu scene,
materialih, teksturah in modelih. V aplikaciji jo lahko preberemo z uporabo
razreda `GLTFLoader`, ki ga najprej vključimo v aplikacijo:

```js
import { GLTFLoader } from 'engine/loaders/GLTFLoader.js';
```

Nato preberemo privzeto sceno in v njej najdemo kamero:

```js
const gltfLoader = new GLTFLoader();
await gltfLoader.load('./models/monkey/monkey.gltf');

const scene = gltfLoader.loadScene(gltfLoader.defaultScene);
const camera = scene.find(node => node.getComponentOfType(Camera));
```

V funkciji `resize` poskrbimo za posodabljanje kamere glede na razmerje med
širimo in višino zaslona:

```js
function resize({ displaySize: { width, height }}) {
    camera.getComponentOfType(Camera).aspect = width / height;
}
```

### Upodabljalnik

Sceno lahko izrišemo z uporabo upodabljalnika `UnlitRenderer`. Najprej ga
vključimo v aplikacijo:

```js
import { UnlitRenderer } from 'engine/renderers/UnlitRenderer.js';
```

Nato ustvarimo upodabljalnik in ga inicializiramo:

```js
const renderer = new UnlitRenderer(canvas);
await renderer.initialize();
```

V funkciji `render` pokličemo istoimensko funkcijo upodabljalnika, ki kot
parametra sprejema sceno in kamero:

```js
function render() {
    renderer.render(scene, camera);
}
```

Na zaslonu se izriše neosvetljen, toda teksturiran 3D model opičje glave.

### Interakcija in animacija

Kot zanimivost dodajmo še interakcijo s kamero ter animacijo modela. Za prvo
bomo uporabili `OrbitController`, za slednjo pa `RotateAnimator`:

```js
import { OrbitController } from 'engine/controllers/OrbitController.js';
import { RotateAnimator } from 'engine/animators/RotateAnimator.js';
```

Razreda instanciramo in objekta pripnemo kot komponenti ustreznim vozliščem:

```js
camera.addComponent(new OrbitController(camera, document.body, {
    distance: 8,
}));

const model = scene.find(node => node.getComponentOfType(Model));
model.addComponent(new RotateAnimator(model, {
    startRotation: [0, 0, 0, 1],
    endRotation: [0.7071, 0, 0.7071, 0],
    duration: 5,
    loop: true,
}));
```

Za pravilno delovanje moramo klicati ustrezne funkcije `update`:

```js
function update(time, dt) {
    scene.traverse(node => {
        for (const component of node.components) {
            component.update?.(time, dt);
        }
    });
}
```

# Osvetljevanje

Upodabljalnik bomo razširili z Lambertovim osvetlitvenim modelom. Za osnovo bomo
uporabili upodabljalnik `UnlitRenderer`, ki ga skopiramo v korenski direktorij
aplikacije v datoteko `MyRenderer.js` in nato razred preimenujemo v `MyRenderer`.
Potrebujemo tudi senčilnik, ki ga skopiramo iz `UnlitRenderer.wgsl`
v korenski direktorij po imenom `MyRenderer.wgsl`. Popravimo poti uvozov in pri
tem popravimo še URL, ki ga `MyRenderer` uporablja za dostop do senčilnika.

V datoteki `main.js` uvozimo nov upodabljalnik:

```js
import { MyRenderer } from './MyRenderer.js';
```

Nato ga instanciramo namesto `UnlitRenderer`:

```js
const renderer = new MyRenderer(canvas);
```

Zdaj lahko upodabljalnik spreminjamo in dopolnjujemo. Najprej bomo dodali
osvetljevanje po Lambertovem modelu s konstantno smerjo svetlobe. Lambertov
model površino osvetli sorazmerno s kosinusom vpadnega kota svetlobe. Kosinus
vpadnega kota lahko enostavno izračunamo s skalarnim produktom, če imamo dostop
do normale površine. Normalo dodamo kot atribut oglišč v razporedu, določenem
v `MyRenderer.js`:

```js
{
    name: 'normal',
    shaderLocation: 2,
    offset: 20,
    format: 'float32x3',
},
```

Pri tem ne pozabimo spremeniti še velikosti oglišča:

```js
arrayStride: 32,
```

Atribut dodamo v senčilnik na lokacijo 2 in poleg tega ustvarimo še
interpoliranko na lokaciji 2:

```rust
struct VertexInput {
    @location(0) position : vec3f,
    @location(1) texcoords : vec2f,
    @location(2) normal : vec3f,
}

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(1) texcoords : vec2f,
    @location(2) normal : vec3f,
}

struct FragmentInput {
    @location(1) texcoords : vec2f,
    @location(2) normal : vec3f,
}

struct FragmentOutput {
    @location(0) color : vec4f,
}
```

V senčilniku oglišč normalo transformiramo z normalno matriko (inverz
transponirane matrike modela), ki je že na voljo v strukturi `ModelUniforms`:

```rust
output.normal = model.normalMatrix * input.normal;
```

V senčilniku fragmentov interpolirano normalo pred uporabo normaliziramo, saj je
pri linearni interpolaciji prišlo do neizogibne spremembe dolžine vektorja:

```rust
let N = normalize(input.normal);
```

Določimo še vektor luči, ki naj bo za zdaj konstanten:

```rust
let L = normalize(vec3f(0, 1, 0));
```

Normalizacija tu sicer ni potrebna, ampak nam omogoča prosto spreminjanje
komponent vektorja brez ozira na njegovo dolžino.

S temi informacijami lahko izračunamo Lambertov osvetlitveni faktor:

```rust
let lambert = max(dot(N, L), 0);
```

S funkcijo `max` se izognemo težavam z negativnim osvetlitvenim faktorjem v
primerih, ko vektor luči in normala oklepata topi kot. Z dobljenim osvetlitvenim
faktorjem pomnožimo barvne (RGB) komponente izhodne barve:

```rust
let materialColor = textureSample(baseTexture, baseSampler, input.texcoords) * material.baseFactor;
let lambertFactor = vec4(vec3(lambert), 1);
output.color = materialColor * lambertFactor;
```

Na zaslonu se izriše osvetljen model.

### Točkast svetlobni vir

Usmerjeni svetlobni vir lahko nadomestimo s točkastim, s katerim lažje
nadzorujemo videz scene. V senčilniku fragmentov bomo potrebovali položaj
fragmenta na površini modela, ki ga lahko zopet pridobimo z interpolacijo, tako
da dodamo ustrezno interpoliranko na lokacijo 0 in preimenujemo obstoječo
izhodno spremenljivko `position` v `clipPosition` (preimenujemo jo tudi v
senčilniku oglišč):

```rust
struct VertexInput {
    @location(0) position : vec3f,
    @location(1) texcoords : vec2f,
    @location(2) normal : vec3f,
}

struct VertexOutput {
    @builtin(position) clipPosition : vec4f,
    @location(0) position : vec3f,
    @location(1) texcoords : vec2f,
    @location(2) normal : vec3f,
}

struct FragmentInput {
    @location(0) position : vec3f,
    @location(1) texcoords : vec2f,
    @location(2) normal : vec3f,
}
```

Položaj v globalnih koordinatah izračunamo z množenjem z matriko modela:

```rust
output.position = (model.modelMatrix * vec4(input.position, 1)).xyz;
```

Posodobimo izračun vektorja `L` za točkast svetlobni vir:

```rust
let L = normalize(lightPosition - input.position);
```

### Ambientna osvetlitev

Ker je model po dodani osvetlitvi zelo temen, ga lahko dodatno osvetlimo z
ambientnim svetlobnim virom. Običajno v računalniški grafiki simuliramo
ambientno osvetlitev tako, da osvetlitvenemu faktorju prištejemo ambientni člen:

```rust
let ambient = 0.3;
let ambientFactor = vec4(vec3(ambient), 1);

output.color = materialColor * (lambertFactor + ambientFactor);
```

S tem je izris precej svetlejši in na videz bolj prijeten.

Na tej točki bi lahko dodali še več parametrov luči, denimo barvo, slabljenje z
razdaljo, zrcalne odboje ipd., toda te funkcionalnosti prepustimo kot dodatno
vajo.

### Komponenta luči

Konstantne parametre v senčilniku bi radi zamenjali z zunanjimi, ki jih lahko
enostavneje nadzorujemo, zato bomo ustvarili komponento luči in jo pripeli na
novo vozlišče v sceni.

Najprej ustvarimo komponento luči v datoteki `Light.js`:

```js
export class Light {

    constructor({
        ambient: 0,
    } = {}) {
        this.ambient = ambient;
    }

}
```

Položaja luči ni treba zapisovati v komponento, saj je temu namenjena že
komponenta `Transform`. Zdaj lahko dodamo luč v sceno:

```js
const light = new Node();
light.addComponent(new Transform({
    translation: [3, 3, 3],
}));
light.addComponent(new Light({
    ambient: 0.3,
}));
scene.addChild(light);
```

Da bo zgornja koda delovala, uvozimo razred `Light`.

Luč lahko upodabljalnik sam poišče v sceni ob klicu funkcije `render`. Iz luči
moramo nato izluščiti položaj v sceni in prebrati parameter ambientne
osvetlitve:

```js
const light = scene.find(node => node.getComponentOfType(Light));
const lightComponent = light.getComponentOfType(Light);
const lightMatrix = getGlobalModelMatrix(light);
const lightPosition = mat4.getTranslation(vec3.create(), lightMatrix);
```

Parametre osvetlitve bomo senčilniku podali prek uniforme, ki vsebuje položaj
in ambientni faktor:

```rust
struct LightUniforms {
    position : vec3f,
    ambient : f32,
}
```

Uniformo dodamo kot zunanji vir in ji dodelimo skupino 3 in številko vezave 0:

```rust
@group(3) @binding(0) var<uniform> light : LightUniforms;
```

Konstantne faktorje lahko zdaj zamenjamo z uniformo:

```rust
let L = normalize(light.position - input.position);
let ambientFactor = vec4(vec3(light.ambient), 1);
```

V upodabljalniku moramo luči prirediti skupino vezav in medpomnilnik uniform,
kar lahko storimo v novi funkciji `prepareLight`:

```js
prepareLight(light) {
    if (this.gpuObjects.has(light)) {
        return this.gpuObjects.get(light);
    }

    const lightUniformBuffer = this.device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const lightBindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(3),
        entries: [
            { binding: 0, resource: { buffer: lightUniformBuffer } },
        ],
    });

    const gpuObjects = { lightUniformBuffer, lightBindGroup };
    this.gpuObjects.set(light, gpuObjects);
    return gpuObjects;
}
```

Funkcijo kličemo v funkciji `render`, kjer zapišemo prej pridobljene parametre
v medpomnilnik uniform:

```js
const { lightUniformBuffer, lightBindGroup } = this.prepareLight(lightComponent);
this.device.queue.writeBuffer(lightUniformBuffer, 0, lightPosition);
this.device.queue.writeBuffer(lightUniformBuffer, 12,
    new Float32Array([lightComponent.ambient]));
this.renderPass.setBindGroup(3, lightBindGroup);
```

### Animacija luči

Kot zanimivost lahko luč tudi animiramo, saj gre za objekt tipa `Node`, ki
vsebuje komponento `Transform`. Dodamo ji lahko denimo linearno gibanje preko
komponente `LinearAnimator`. Najprej jo uvozimo:

```js
import { LinearAnimator } from 'engine/animators/LinearAnimator.js';
```

Nato komponento dodamo luči:

```js
light.addComponent(new LinearAnimator(light, {
    startPosition: [3, 3, 3],
    endPosition: [-3, -3, -3],
    duration: 1,
    loop: true,
}));
```

Vidimo, da se položaj luči spreminja in da se gibanje odraža tudi pri izrisu.

# Naloge

1. Program dopolni tako, da bo luč imela tudi barvo.
2. Lambertov osvetlitveni model dopolni s Phongovim modelom za upodabljanje
zrcalnih odbojev svetlobe. Poleg položaja luči bo senčilnik potreboval še
položaj kamere. Za zrcalni odboj svetlobe si lahko pomagaš s funkcijo `reflect`.
3. Točkasto luč spremeni v reflektorsko, tako da ji dodaš zorni kot. Smer luči
je določena z njeno lokalno transformacijo. Senčilnik fragmentov naj glede na
zorni kot luči preveri, ali je fragment osvetljen ali ne.
4. Senčilnik posodobi tako, da bo sprejemal 4 luči (uporabi `array`).
Upodabljalnik naj v grafu scene poišče 4 luči oz. uniforme manjkajočih luči
nastavi tako, da ne vplivajo na osvetlitev.
