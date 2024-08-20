# Kocka

V tej vaji bomo kvadrat nadgradili v kocko. V ta namen bomo posodobili podatke,
cevovod in senčilnik. Poskrbeli bomo še za postavitev kamere v sceno in vse
potrebne transformacije.

### Podatki

Oglišča kocke bomo postavili na koordinate ±1. Položajem bomo dodali še homogeno
koordinato, tako da jih bomo lažje obdelovali v senčilniku. Vsako oglišče bo
imelo tudi svojo barvo, ki bo odražala položaj oglišča. Kocka ima 6 kvadratnih
ploskev, vsaka je predstavljena z 2 trikotnikoma, kar skupaj znese 36 indeksov.

```js
const vertices = new Float32Array([
    // positions         // colors         // index
    -1, -1, -1,  1,      0,  0,  0,  1,    //   0
    -1, -1,  1,  1,      0,  0,  1,  1,    //   1
    -1,  1, -1,  1,      0,  1,  0,  1,    //   2
    -1,  1,  1,  1,      0,  1,  1,  1,    //   3
     1, -1, -1,  1,      1,  0,  0,  1,    //   4
     1, -1,  1,  1,      1,  0,  1,  1,    //   5
     1,  1, -1,  1,      1,  1,  0,  1,    //   6
     1,  1,  1,  1,      1,  1,  1,  1,    //   7
]);

const indices = new Uint32Array([
    0, 1, 2,    2, 1, 3,
    4, 0, 6,    6, 0, 2,
    5, 4, 7,    7, 4, 6,
    1, 5, 3,    3, 5, 7,
    6, 2, 7,    7, 2, 3,
    1, 0, 5,    5, 0, 4,
]);
```

### Format podatkov

Nova oglišča so velika 32 bajtov, pri čemer prvih 16 bajtov zaseda položaj,
drugih 16 bajtov pa barva oglišča.

```js
const vertexBufferLayout = {
    arrayStride: 32,
    attributes: [
        {
            shaderLocation: 0,
            offset: 0,
            format: 'float32x4',
        },
        {
            shaderLocation: 1,
            offset: 16,
            format: 'float32x4',
        },
    ],
};
```

### Senčilnik

Senčilnik posodobimo tako, da bo atribut `position` odražal zgornje spremembe:

```rust
@location(0) position: vec4f,
```

V glavni funkciji položaju ni več treba dodati dveh fiksnih komponent, saj jih
v senčilnik prinesemo že z atributom:

```rust
output.position = matrix * input.position;
```

Senčilnik in podatki so zdaj pripravljeni za delo v treh dimenzijah.

# Transformacije

### Knjižnica glMatrix

Transformacije 3D modelov bomo izvajali s pomočjo 4x4 matrik. Pisanje lastnih
funkcij za delo z matrikami in vektorji je dobra vaja za programiranje, mi pa
bomo uporabili kar obstoječo knjižnico `glMatrix`, ki je optimizirana za čim
hitrejše izvajanje.

Knjižnico dobimo na naslovu <https://raw.githubusercontent.com/UL-FRI-LGM/webgpu-examples/master/lib/glm.js>.

V skripto `main.js` uvozimo kodo za delo s 4x4 matrikami:

```js
import { mat4 } from './glm.js';
```

### Postavitev scene

Potrebujemo tri matrike: transformacijsko matriko modela, ki model iz lokalnega
prostora postavi v globalni prostor, transformacijsko matriko pogleda, ki model
iz globalnega prostora postavi v glediščni prostor, in projekcijsko matriko,
ki model iz glediščnega prostora postavi v rezalni prostor. Grafična kartica bo
po rezanju izvedla še perspektivno deljenje, rezultat katerega bodo točke v
normaliziranem prostoru zaslona. Temu sledita le še zaslonska preslikava in
rasterizacija.

Glede koordinatnih sistemov bomo sledili zgledu, ki ga postavljajo vsi večji
grafični pogoni: koordinatni sistemi bodo desnosučni, pogled kamere je usmerjen
vzdolž negativne smeri lokalne osi *z*.

Matrika pogleda in projekcijska matrika naj bosta za zdaj fiksni, matriko modela
pa bomo spreminjali v funkciji `update`. Kocko bomo postavili v izhodišče,
kamero pa bomo premaknili za 5 enot nazaj, tako da bo vidna celotna kocka.
Najprej ustvarimo matriko pogleda, ki je inverzna transformacijski matriki
kamere:

```js
const viewMatrix = mat4.fromTranslation(mat4.create(), [0, 0, -5]);
```

Tudi projekcijska matrika naj bo fiksna, z vertikalnim zornim kotom 1 radian,
razmerjem med višino in širino zaslona 1 (platno je namreč kvadratno), ter
sprednjo in zadnjo rezalno ravnino na razdalji 0.01 in 1000 enot:

```js
const projectionMatrix = mat4.perspectiveZO(mat4.create(), 1, 1, 0.01, 1000);
```

Ustvarimo še matriko modela:

```js
const modelMatrix = mat4.create();
```

Kocko animiramo v funkciji `update`:

```js
const time = performance.now() / 1000;
modelMatrix.identity().rotateX(time * 0.6).rotateY(time * 0.7);
```

Zgornja koda matriko modela najprej ponastavi, sicer bi se ohranjala skozi
zaporedne slike animacije.

### Prenos transformacije v senčilnik

Senčilnik sprejema le eno matriko, ki predstavlja združeno transformacijo
modela, pogleda in projekcije. V funkciji `render` jih zmnožimo in pri tem
pazimo na vrstni red množenja:

```js
const matrix = mat4.create()
    .multiply(projectionMatrix)
    .multiply(viewMatrix)
    .multiply(modelMatrix);
```

Rezultat zapišemo v medpomnilnik:

```js
device.queue.writeBuffer(uniformBuffer, 0, matrix);
```

Na platnu bi morala biti vidna vrteča se kocka.

### Globinska slika

Nenavadno prekrivanje ploskev kocke je posledica odsotnosti globinskega testa.
Za pravilno delovanje moramo ustvariti globinsko sliko, vključiti globinski test
in globinsko sliko počistiti pred vsakim izrisom.

Ustvarimo globinsko sliko v velikosti platna in s primernim globinskim formatom:

```js
const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
});
```

Vključimo globinski test v cevovodu:

```js
depthStencil: {
    depthWriteEnabled: true,
    depthCompare: 'less',
    format: 'depth24plus',
}
```

Globinski sliko pripnemo na cevovod v obhodu upodabljanja:

```js
depthStencilAttachment: {
    view: depthTexture.createView(),
    depthClearValue: 1,
    depthLoadOp: 'clear',
    depthStoreOp: 'discard',
}
```

S tem bi moralo nepravilno prekrivanje ploskev izginiti.

# Komponentni sistem

Trenutno je v datoteki `main.js` združeno veliko funkcionalnosti, ki bi jo bilo
bolje ločiti na več delov, ki jih bomo lahko ponovno uporabili. Refaktorizacijo
bomo pričeli pri transformacijah. Ustvarili bomo dva razreda, `Transform` in
`Camera`, ki bosta zadolžena za ustvarjanje transformacijskih matrik preko
intuitivnih parametrov. Nato bomo ustvarili še razred `Node`, ki bo predstavljal
posamezno vozlišče v grafu scene in vseboval seznam pripetih komponent.

### Komponenti Transform in Camera

Začnimo z razredom `Transform`, ki ga zapišimo v datoteko `Transform.js`:

```js
import { mat4 } from './glm.js';

export class Transform {

    constructor({
        rotation = [0, 0, 0, 1],
        translation = [0, 0, 0],
        scale = [1, 1, 1],
    } = {}) {
        this.rotation = rotation;
        this.translation = translation;
        this.scale = scale;
    }

    get matrix() {
        return mat4.fromRotationTranslationScale(mat4.create(),
            this.rotation, this.translation, this.scale);
    }

}
```

Razred je napisan tako, da ga lahko enostavno instanciramo in pri tem opcijsko
dodamo parametre vrtenja, premika in raztega. Vrtenje je, kot v večini sodobnih
grafičnih pogonov, predstavljeno s kvaternionom.

Dodajmo še razred `Camera` za predstavitev perspektivne kamere in ga zapišimo
v datoteko `Camera.js`:

```js
import { mat4 } from './glm.js';

export class Camera {

    constructor({
        aspect = 1,
        fovy = 1,
        near = 0.01,
        far = 1000,
    } = {}) {
        this.aspect = aspect;
        this.fovy = fovy;
        this.near = near;
        this.far = far;
    }

    get matrix() {
        const { fovy, aspect, near, far } = this;
        return mat4.perspectiveZO(mat4.create(), fovy, aspect, near, far);
    }

}
```

### Graf scene

Ustvarjeni komponenti bomo pripeli na objekte v sceni, ki jih bomo predstavili
z grafom. Bolj natančno, ustvarili bomo razred `Node`, ki bo predstavljal
objekte v grafu scene. Vsak objekt ima lahko več otrok in kvečjemu enega starša.

Razred `Node` zapišimo v datoteko `Node.js`.

```js
export class Node {

    constructor() {
        this.parent = null;
        this.children = [];
        this.components = [];
    }

    addChild(node) {
        node.parent?.removeChild(node);
        node.parent = this;
        this.children.push(node);
    }

    removeChild(node) {
        const index = this.children.indexOf(node);
        if (index >= 0) {
            this.children.splice(index, 1);
            node.parent = null;
        }
    }

    traverse(before, after) {
        before?.(this);
        for (const child of this.children) {
            child.traverse(before, after);
        }
        after?.(this);
    }

    linearize() {
        const array = [];
        this.traverse(node => array.push(node));
        return array;
    }

    filter(predicate) {
        return this.linearize().filter(predicate);
    }

    find(predicate) {
        return this.linearize().find(predicate);
    }

    map(transform) {
        return this.linearize().map(transform);
    }

    addComponent(component) {
        this.components.push(component);
    }

    removeComponent(component) {
        this.components = this.components.filter(c => c !== component);
    }

    removeComponentsOfType(type) {
        this.components = this.components.filter(component => !(components instanceof type));
    }

    getComponentOfType(type) {
        return this.components.find(component => component instanceof type);
    }

    getComponentsOfType(type) {
        return this.components.filter(component => component instanceof type);
    }

}
```

Razred `Node` vsebuje osnovne metode za delo z grafom scene in za upravljanje s
komponentami.

Če želimo v sceno dodati objekt z določeno transformacijo, lahko to zdaj
enostavno storimo z uporabo zgornjih razredov:

```js
const object = new Node();
object.addComponent(new Transform({
    translation: [1, 2, 3]
}));

const scene = new Node();
scene.addChild(object);
```

Ker lahko na posamezen objekt dodamo poljubno količino komponent (vključujoč
transformacije), je pridobivanje transformacijskih matrik nekoliko bolj težavno.
Poleg tega moramo upoštevati še celoten graf scene in s tem povezano združevanje
transformacijskih matrik. Za enostavnejše delo s transformacijami ustvarimo še
datoteko `SceneUtils.js`, kamor bomo zapisali funkcije za združevanje matrik:

```js
import { mat4 } from './glm.js';

import { Transform } from './Transform.js';
import { Camera } from './Camera.js';

export function getLocalModelMatrix(node) {
    const matrix = mat4.create();
    for (const transform of node.getComponentsOfType(Transform)) {
        matrix.multiply(transform.matrix);
    }
    return matrix;
}

export function getGlobalModelMatrix(node) {
    if (node.parent) {
        const parentMatrix = getGlobalModelMatrix(node.parent);
        const modelMatrix = getLocalModelMatrix(node);
        return parentMatrix.multiply(modelMatrix);
    } else {
        return getLocalModelMatrix(node);
    }
}

export function getLocalViewMatrix(node) {
    return getLocalModelMatrix(node).invert();
}

export function getGlobalViewMatrix(node) {
    return getGlobalModelMatrix(node).invert();
}

export function getProjectionMatrix(node) {
    return node.getComponentOfType(Camera)?.matrix ?? mat4.create();
}
```

### Uporaba komponentnega sistema

Zdaj lahko veliko funkcionalnosti naše aplikacije poenostavimo z uporabo
komponentnega sistema. Najprej v datoteko `main.js` uvozimo vse potrebne razrede
in funkcije:

```js
import { quat, mat4 } from './glm.js';
import { Transform } from './Transform.js';
import { Camera } from './Camera.js';
import { Node } from './Node.js';
import {
    getGlobalModelMatrix,
    getGlobalViewMatrix,
    getProjectionMatrix,
} from './SceneUtils.js';
```

Nato ustvarimo sceno:

```js
const model = new Node();
model.addComponent(new Transform());

const camera = new Node();
camera.addComponent(new Camera());
camera.addComponent(new Transform({
    translation: [0, 0, 5]
}));

const scene = new Node();
scene.addChild(model);
scene.addChild(camera);
```

Posamezne transformacijske matrike lahko izbrišemo.

V funkciji `render` poenostavimo pridobivanje transformacijskih matrik:

```js
const modelMatrix = getGlobalModelMatrix(model);
const viewMatrix = getGlobalViewMatrix(camera);
const projectionMatrix = getProjectionMatrix(camera);
```

V funkciji `update` lahko posodobimo vse komponente vseh objektov v sceni
hkrati, tako da pokličemo njihove lastne funkcije `update`, če so na voljo:

```js
scene.traverse(node => {
    for (const component of node.components) {
        component.update?.();
    }
});
```

S tem lahko animacijo kocke izločimo iz glavne funkcije `update` in jo dodamo
kot komponento:

```js
model.addComponent({
    update() {
        const time = performance.now() / 1000;
        const transform = model.getComponentOfType(Transform);
        const rotation = transform.rotation;

        quat.identity(rotation);
        quat.rotateX(rotation, rotation, time * 0.6);
        quat.rotateY(rotation, rotation, time * 0.7);
    }
});
```
