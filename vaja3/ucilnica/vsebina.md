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

V glavni funkciji za zdaj položaj le zapišimo v izhodno spremenljivko
`position`:

```rust
output.position = input.position;
```

Uniformo `translation` lahko izbrišemo, ker jo bomo v nadaljevanju nadomestili
s transformacijsko matriko.

Senčilnik in podatki so zdaj pripravljeni za delo v treh dimenzijah.

# Transformacije

### Knjižnica glMatrix

Transformacije 3D modelov bomo izvajali s pomočjo 4x4 matrik. Pisanje lastnih
funkcij za delo z matrikami in vektorji je dobra vaja za programiranje, mi pa
bomo uporabili kar obstoječo knjižnico `glMatrix`, ki je optimizirana za čim
hitrejše izvajanje.

Knjižnico dobimo na naslovu <https://github.com/toji/gl-matrix/blob/master/dist/gl-matrix-min.js>.
Gre za minificirano različico v formatu CommonJS, zato jo bomo, za izogib delu
s prevajalniki, v aplikacijo dodali v dveh korakih.

Knjižnico bomo najprej vključili kot navadno skripto v glavo `index.html` *pred*
skripto `main.js`:

```html
<script src="gl-matrix-min.js"></script>
```

Če želimo skripto uporabljati kot modul, moramo ustvariti še datoteko
`gl-matrix-module.js`, ki globalno spremenljivko `glMatrix` izvozi v primerno
obliko:

```js
export const { mat2, mat2d, mat3, mat4, quat, quat2, vec2, vec3, vec4 } = glMatrix;
```

Zdaj lahko v skripto `main.js` uvozimo kodo za delo s 4x4 matrikami:

```js
import { mat4 } from './gl-matrix-module.js';
```

### Postavitev scene

Potrebujemo tri matrike: transformacijsko matriko modela, ki model iz lokalnega
prostora postavi v globalni prostor, transformacijsko matriko pogleda, ki model
iz globalnega prostora postavi v glediščni prostor, in projekcijsko matriko,
ki model iz glediščnega prostora postavi v normaliziran prostor zaslona.

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
mat4.identity(modelMatrix);
mat4.rotateX(modelMatrix, modelMatrix, time * 0.6);
mat4.rotateY(modelMatrix, modelMatrix, time * 0.7);
```

Zgornja koda matriko modela najprej ponastavi, sicer bi se ohranjala skozi
zaporedne slike animacije.

### Prenos transformacije v senčilnik

V senčilnik dodamo uniformo za transformacijsko matriko:

```rust
@group(0) @binding(0) var<uniform> matrix: mat4x4f;
```

V glavni funkciji jo pomnožimo s položajem oglišča:

```rust
output.position = matrix * input.position;
```

Za prenos matrike lahko recikliramo medpomnilnik in skupino vezav iz prejšnje
vaje:

```js
const matrixBuffer = device.createBuffer({
    size: 16 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const bindGroup = device.createBindGroup({
    layout: device.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: { buffer: matrixBuffer } },
    ]
})
```

Senčilnik sprejema le eno matriko, ki predstavlja združeno transformacijo
modela, pogleda in projekcije. V funkciji `render` jih zmnožimo in pri tem
pazimo na vrstni red množenja:

```js
const matrix = mat4.create();
mat4.multiply(matrix, modelMatrix, matrix);
mat4.multiply(matrix, viewMatrix, matrix);
mat4.multiply(matrix, projectionMatrix, matrix);
```

Rezultat zapišemo v medpomnilnik:

```js
device.queue.writeBuffer(matrixBuffer, 0, matrix);
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
