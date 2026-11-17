# Casos de prueba del dictado (prototipo)

Diez dictados para probar el extractor por reglas (`nlp_simulado`) y el motor simulado
(`motor_simulado`, versión `simulado-0.1`) con las mascotas de la base de demo. Cada caso dice
qué mascota usar, qué signos tendría que detectar y qué sugerencia debería aparecer. Los
resultados se midieron corriendo el extractor y el motor de la rama `feature/consulta-prototipo`.
Si cambia la base de conocimiento, cambian los números.

**Cómo probar un caso.** Abrí una consulta para la mascota: desde su turno en la agenda, o con
**+ Nueva Consulta** buscándola por nombre. Pegá el texto en **Transcripción (editable)** y tocá
**Procesar dictado**. Mirá la ficha, los signos (presentes y negados) y las sugerencias. Al
terminar tocá **Descartar**. Así no quedan borradores en la base compartida, porque las
consultas firmadas no se pueden borrar.

**Las mascotas.** Coco es de Martín Rossi. Thor y Mora son de Carla Gómez. Lola, Kiki y Bela
están con el tutor eventual. Luna queda reservada para el recorrido con **Iniciar dictado**: es
Cocker, así que el texto de prueba es el de otitis.

Los porcentajes están escritos como los muestra la pantalla: ">99%" desde 99,5 y "<1%" debajo
de 1.

---

### 1. Thor (Labrador Retriever): displasia de cadera

> Viene porque renguea de atrás desde hace un mes y le cuesta levantarse después de dormir. No
> tose ni vomita. Pesa 35 kilos, temperatura 38,6. Dolor a la manipulación de la cadera. Indico
> antiinflamatorio, bajar de peso y radiografía de cadera.

Tendría que detectar claudicación, dificultad para levantarse y dolor de cadera como presentes, y
tos y vómitos como **negados**. La negación con "ni" alcanza al segundo signo. Peso 35 y
temperatura 38,6.

**Sugerencia:** Displasia de cadera >99%.

Muestra el multiplicador ×2,5 del Labrador y el estudio sugerido: radiografía de cadera.

### 2. Mora (Pastor Alemán): displasia de cadera

> Viene porque le cuesta pararse y cojea de las patas traseras. La dueña dice que no está
> decaída. Pesa 29,5 kilos, temperatura 38,4. Dolor en la cadera al extender los miembros. Indico
> radiografía de cadera y control en dos semanas.

Tendría que detectar dificultad para levantarse, claudicación y dolor de cadera como presentes, y
decaimiento como negado.

**Sugerencia:** Displasia de cadera >99%.

El Pastor Alemán es la raza con multiplicador más alto para esta patología: ×4.

### 3. Lola (Caniche Toy): otitis externa

> Viene porque sacude la cabeza todo el tiempo y se rasca las orejas. No tiene fiebre. Pesa 3,1
> kilos, temperatura 38,7. Secreción marrón en el oído derecho. Indico limpieza ótica y gotas por
> siete días.

Tendría que detectar sacudida de cabeza, prurito ("se rasca") y secreción en el oído como
presentes, y fiebre como negada.

**Sugerencias:** Otitis externa >99%, Dermatitis atópica <1%.

### 4. Kiki (sin raza definida): gastroenteritis aguda

> Viene porque vomitó tres veces desde ayer y tiene diarrea. Está decaída y no come. Pesa 9
> kilos, temperatura 39,6. Dolor abdominal a la palpación. Indico dieta blanda, hidratación y
> control en 48 horas.

Tendría que detectar cinco signos presentes: vómitos, diarrea, decaimiento, inapetencia y dolor
abdominal. "No come" cuenta como **presente**: la frase entera es el signo, no es una negación.

**Sugerencia:** Gastroenteritis aguda >99%.

### 5. Bela (Beagle): dermatitis atópica

> Viene porque se rasca todo el día y se lame las patas. No sacude la cabeza. Pesa 2,4 kilos,
> temperatura 38,5. No hay secreción en los oídos. Indico baño medicado y control en tres
> semanas.

Tendría que detectar prurito y lamido de patas como presentes, y sacudida de cabeza y secreción
en el oído como negados.

**Sugerencia:** Dermatitis atópica >99%.

Los signos negados son los que separan la dermatitis de la otitis. El Beagle no tiene código en
el prototipo, así que no hay multiplicador de raza, y el síndrome braquicefálico no aparece
porque solo se sugiere en razas predispuestas.

### 6. Thor (Labrador Retriever): dermatitis atópica

> Viene porque tiene mucha picazón y se chupa las patas, sobre todo en primavera. No renguea.
> Pesa 34 kilos, temperatura 38,5. Indico baño medicado y control en tres semanas.

Tendría que detectar prurito y lamido de patas como presentes, y claudicación como negada.

**Sugerencias:** Dermatitis atópica 99%, Otitis externa 1%.

Es la misma mascota del caso 1 con otro cuadro, y la sugerencia cambia.

### 7. Coco (Bulldog Francés): control con menos signos

> Viene a control. Sigue roncando de noche pero ya no se cansa al caminar y no tose. Pesa 13
> kilos, temperatura 38,6. Indico seguir con reposo relativo y evitar el calor.

Tendría que detectar ronquido como presente, e intolerancia al ejercicio y tos como negadas.

**Sugerencias:** Síndrome braquicefálico 60%, Dermatitis atópica 17%, Gastroenteritis aguda 11%.

Con menos evidencia, el porcentaje baja. Es el caso para hablar de los controles: lo que
interesa ahí es la evolución respecto de la consulta anterior, no un diagnóstico nuevo.

### 8. Lola (Caniche Toy): gastroenteritis leve

> Viene porque tiene diarrea desde hace dos días. No vomitó y no tiene fiebre, pero come poco.
> Pesa 3 kilos, temperatura 38,9. Indico dieta blanda y probióticos.

Tendría que detectar diarrea e inapetencia como presentes, y vómitos y fiebre como negados.

**Sugerencias:** Gastroenteritis aguda 98%, Otitis externa 1%.

### 9. Mora (Pastor Alemán): dos problemas a la vez

> Viene porque cojea de la pata trasera izquierda y además vomitó dos veces anoche. Está
> decaída. Pesa 29 kilos, temperatura 38,8. Indico radiografía y análisis de sangre.

Tendría que detectar claudicación, vómitos y decaimiento, todos presentes.

**Sugerencias:** Gastroenteritis aguda 94%, Displasia de cadera 6%.

Sirve para mostrar que la decisión es del profesional: puede aceptar la gastroenteritis como
principal y la displasia como secundaria.

### 10. Kiki (sin raza definida): el caso trampa

> Viene porque ronca mucho y se agita al caminar. Pesa 9 kilos, temperatura 38,5. Indico control
> y estudios.

Tendría que detectar ronquido e intolerancia al ejercicio, los dos presentes.

**Resultado de hoy:** Displasia de cadera 81%, Gastroenteritis aguda 8%, Otitis externa 6%.
**Está mal.**

Por qué pasa:

1. El braquicefálico queda afuera porque Kiki no es de raza predispuesta.
2. De las cuatro patologías que quedan, solo la displasia relaciona la intolerancia al ejercicio
   (frecuencia 0,5).
3. El motor normaliza para que el catálogo sume 100%. Entonces infla a la única patología que
   explica algo, aunque no tenga sentido clínico.

Un profesor que pruebe síntomas fuera del catálogo va a caer en esto.

**Arreglo propuesto:** sumar al denominador una "otra causa no contemplada". Su probabilidad base
es 1 − la suma de las prevalencias (0,85), con frecuencia 0,05 por signo, que es el nivel "raro"
de la escala ordinal. Con eso, este caso baja a Displasia 8% y la pantalla puede avisar
"Evidencia insuficiente para sugerir". Los casos fuertes (1 a 6 y la demo de Coco) siguen en
>99%.

---

Estos diez casos pueden pasar a ser tests automáticos con pytest parametrizado. Así nadie rompe
el extractor o el motor sin enterarse.
