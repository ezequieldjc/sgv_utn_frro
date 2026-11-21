# Casos de prueba del dictado (prototipo)

Doce dictados para probar el extractor por reglas (`nlp_simulado`) y el motor simulado
(`motor_simulado`, versión `simulado-0.2`) con las mascotas de la base de demo. Cada caso dice
qué mascota usar, qué signos tendría que detectar y qué sugerencia debería aparecer. Los
resultados se midieron corriendo el extractor y el motor, y están automatizados en
`backend/tests/test_casos_dictado.py`: si alguien cambia los sinónimos, las negaciones o la base
de conocimiento y un caso cambia, el test lo avisa.

**Cómo probar un caso.** Abrí una consulta para la mascota: desde su turno en la agenda, o con
**+ Nueva Consulta** buscándola por nombre. Pegá el texto en **Transcripción (editable)** y tocá
**Procesar dictado**. Mirá la ficha, los signos (presentes y negados) y las sugerencias. Al
terminar tocá **Descartar**. Así no quedan borradores en la base compartida, porque las
consultas firmadas no se pueden borrar.

**Las mascotas.** Coco es de Martín Rossi. Thor y Mora son de Carla Gómez. Lola, Kiki y Bela
están con el tutor eventual. Luna queda reservada para el recorrido con **Iniciar dictado**: es
Cocker, así que el texto de prueba es el de otitis. Felipe y Simón son dos Shar Pei de Joaquín
Ferreyra, el cliente de prueba de los recordatorios (su celular es el de Bruno). El caso 11 es el
texto de **Iniciar dictado** de la raza: la consulta de Felipe se hace en vivo en la demo, así que
no se firma antes. Para Simón, el caso 12 se pega en la transcripción.

Los porcentajes están escritos como los muestra la pantalla: ">99%" desde 99,5 y "<1%" debajo
de 1. Desde `simulado-0.2` el cálculo incluye una hipótesis "otra causa no contemplada" en el
catálogo, que la pantalla muestra debajo de las sugerencias. Por eso las tres sugerencias pueden
sumar menos de 100%. Cuando esa hipótesis pesa más que la primera sugerencia, aparece el aviso
**Evidencia insuficiente**.

---

### 1. Thor (Labrador Retriever): displasia de cadera

> Viene porque renguea de atrás desde hace un mes y le cuesta levantarse después de dormir. No
> tose ni vomita. Pesa 35 kilos, temperatura 38,6. Dolor a la manipulación de la cadera. Indico
> antiinflamatorio, bajar de peso y radiografía de cadera.

Tendría que detectar claudicación, dificultad para levantarse y dolor de cadera como presentes, y
tos y vómitos como **negados**. La negación con "ni" alcanza al segundo signo. Peso 35 y
temperatura 38,6.

**Sugerencia:** Displasia de cadera 99%.

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

**Sugerencias:** Otitis externa 99%, Dermatitis atópica <1%.

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

**Sugerencia:** Dermatitis atópica 83%. Otra causa: 17%.

Los signos negados son los que separan la dermatitis de la otitis. El Beagle no tiene código en
el prototipo, así que no hay multiplicador de raza, y el síndrome braquicefálico no aparece
porque solo se sugiere en razas predispuestas.

### 6. Thor (Labrador Retriever): dermatitis atópica

> Viene porque tiene mucha picazón y se chupa las patas, sobre todo en primavera. No renguea.
> Pesa 34 kilos, temperatura 38,5. Indico baño medicado y control en tres semanas.

Tendría que detectar prurito y lamido de patas como presentes, y claudicación como negada.

**Sugerencias:** Dermatitis atópica 92%, Otitis externa 1%. Otra causa: 6%.

Es la misma mascota del caso 1 con otro cuadro, y la sugerencia cambia.

### 7. Coco (Bulldog Francés): control con menos signos

> Viene a control. Sigue roncando de noche pero ya no se cansa al caminar y no tose. Pesa 13
> kilos, temperatura 38,6. Indico seguir con reposo relativo y evitar el calor.

Tendría que detectar ronquido como presente, e intolerancia al ejercicio y tos como negadas.

**Sugerencias:** Síndrome braquicefálico 11%, Dermatitis atópica 3%, Gastroenteritis aguda 2%.
Otra causa: 82%, con el aviso **Evidencia insuficiente**.

Con un solo signo presente, el braquicefálico sigue primero pero no alcanza para sugerir. Es el caso para hablar de los controles: lo que
interesa ahí es la evolución respecto de la consulta anterior, no un diagnóstico nuevo.

### 8. Lola (Caniche Toy): gastroenteritis leve

> Viene porque tiene diarrea desde hace dos días. No vomitó y no tiene fiebre, pero come poco.
> Pesa 3 kilos, temperatura 38,9. Indico dieta blanda y probióticos.

Tendría que detectar diarrea e inapetencia como presentes, y vómitos y fiebre como negados.

**Sugerencias:** Gastroenteritis aguda 62%, Otitis externa <1%. Otra causa: 37%.

### 9. Mora (Pastor Alemán): dos problemas a la vez

> Viene porque cojea de la pata trasera izquierda y además vomitó dos veces anoche. Está
> decaída. Pesa 29 kilos, temperatura 38,8. Indico radiografía y análisis de sangre.

Tendría que detectar claudicación, vómitos y decaimiento, todos presentes.

**Sugerencias:** Gastroenteritis aguda 75%, Displasia de cadera 5%. Otra causa: 20%.

Sirve para mostrar que la decisión es del profesional: puede aceptar la gastroenteritis como
principal y la displasia como secundaria.

### 10. Kiki (sin raza definida): el caso trampa

> Viene porque ronca mucho y se agita al caminar. Pesa 9 kilos, temperatura 38,5. Indico control
> y estudios.

Tendría que detectar ronquido e intolerancia al ejercicio, los dos presentes.

**Resultado:** Displasia de cadera 8%, Gastroenteritis aguda <1%, Otitis externa <1%. Otra
causa: 90%, con el aviso **Evidencia insuficiente**.

Hasta `simulado-0.1` este caso daba "Displasia de cadera 81%", y eso estaba mal. Pasaba por tres
cosas juntas:

1. El braquicefálico queda afuera porque Kiki no es de raza predispuesta.
2. De las cuatro patologías que quedan, solo la displasia relaciona la intolerancia al ejercicio
   (frecuencia 0,5).
3. El motor repartía el 100% entre las patologías del catálogo, así que inflaba a la única que
   explicaba algo, aunque no tuviera sentido clínico.

El arreglo fue sumar al cálculo la hipótesis "otra causa no contemplada". Su probabilidad base es
lo que la suma de las prevalencias deja afuera (0,85, con un piso de 0,10 para cuando el catálogo
crezca), y la frecuencia es 0,05 por signo presente, el nivel "raro" de la escala. Es el caso para
mostrar, a propósito, que el sistema reconoce cuándo no sabe.

### 11. Felipe (Shar Pei): dermatitis atópica con predisposición de raza

> Viene porque se rasca todo el día y se lame las patas desde hace un mes. El dueño cuenta que
> empeora en primavera, que no vomita ni tiene diarrea y que come bien. Pesa 21,5 kilos,
> temperatura 38,7. Presenta enrojecimiento en los pliegues de la cara, en las axilas y entre los
> dedos. No sacude la cabeza. Pido raspado cutáneo. Indico baño con clorhexidina cada tres días,
> oclacitinib 16 mg un comprimido cada 12 horas por 14 días y control en quince días.

Tendría que detectar prurito y lamido de patas como presentes, y vómitos, diarrea y sacudida de
cabeza como negados. Arma también la ficha completa: el pedido de raspado va a observaciones y la
indicación entera va a tratamiento, que es lo que después sale en la receta en PDF.

**Sugerencia:** Dermatitis atópica 95%. Otra causa: 5%.

Es el caso para mostrar el sesgo por raza: el Shar Pei suma predisposición ×4 a la dermatitis
atópica (y ×2,5 a la otitis externa, por el conducto auditivo estrecho). Sin ese multiplicador,
el mismo dictado da 83%. Para que el motor lo reconozca, el Shar Pei tiene el código
`chinese-shar-pei` desde `scripts/clinica/008_vacunas_recordatorios.sql`.

### 12. Simón (Shar Pei): otitis externa

> Viene porque sacude la cabeza y tiene mal olor en las orejas desde hace cinco días. El dueño
> cuenta que se rasca las orejas de noche y que no tiene fiebre. Pesa 23,8 kilos, temperatura
> 38,5. Presenta el conducto auditivo derecho estrecho y enrojecido, con secreción marrón. Pido
> citología de oído. Indico limpiador ótico cada 12 horas, gotas de gentamicina con betametasona
> cinco gotas cada 12 horas por diez días y control en diez días.

Tendría que detectar sacudida de cabeza, prurito y secreción en el oído como presentes, y fiebre
como negada.

**Sugerencias:** Otitis externa 99%, Dermatitis atópica 1%.

---

Los doce casos están en `backend/tests/test_casos_dictado.py`. Corren con el resto de los tests
del backend, también en el CI de cada PR.
