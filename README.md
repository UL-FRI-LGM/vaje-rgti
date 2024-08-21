# Vaje RGTI

Repozitorij vsebuje navodila in kodo za vaje računalniške grafike na Fakulteti
za računalništvo in informatiko Univerze v Ljubljani.

WebGPU je spletni vmesnik za dostop do grafične strojne opreme. Kot naslednik
vmesnika WebGL je bolj zmogljiv, vsebuje več funkcionalnosti in omogoča pisanje
bolj berljive kode brez raznovrstnih pasti, ki so še kako prisotne v WebGL.
WebGPU je v zasnovi podoben sodobnim grafičnim vmesnikom za razvoj namiznih
aplikacij. V primerjavi z WebGL se bistveno bolje prilagaja arhitekturi sodobnih
grafičnih kartic, zato je ob spretni uporabi njegovo delovanje hitrejše in
bolj predvidljivo. WebGPU poleg izrisa omogoča tudi splošno računanje preko
računskih senčilnikov, kar je še posebej dobrodošlo v aplikacijah, ki se denimo
zanašajo na hitro izvajanje nevronskih mrež.

Potrebna orodja:
- **Sodoben spletni brskalnik** (trenutno Chromium in njegovi derivati (Chrome,
Opera, Edge) najbolje podpirajo standard WebGPU)
- **Urejevalnik kode** (priporočamo Sublime Text ali Visual Studio Code)
- **HTTP strežnik** (najenostavneje `python -m http.server`, sicer pa bo deloval
katerikoli strežnik)

## Seznam vaj

1. Osnove WebGPU
    - Postavitev okolja
    - Inicializacija vmesnika
    - Obhod upodabljanja
    - Cevovod
    - Senčilniki
    - Interpoliranke
2. Prenos podatkov
    - Ločeni atributi
    - Prepleteni atributi
    - Indeksiranje
    - Uniforme
    - Vezave in skupine vezav
3. Osnove grafičnih pogonov
    - Transformacije v prostoru
    - Globinska slika
    - Graf scene
    - Komponentni sistem
4. Teksturiranje
    - Prenos teksture
    - Vzorčenje in vzorčevalniki
    - Teksturne koordinate
    - Alias
5. Osvetljevanje
    - Uporaba ogrodja in branje modela iz datoteke
    - Normale
    - Lambertov model
    - Usmerjen svetlobni vir
    - Točkast svetlobni vir
    - Ambientna osvetlitev
