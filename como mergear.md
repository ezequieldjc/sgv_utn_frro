# Tipos de Ramas 🪵
## Rama main: 
    
    - Sobre esta rama corre el vercel. Es decir, es nuestra rama 'productiva' (CD).
    
    - Es decir, ni bien hagamos un push a esta rama, cambiamos el sistema en produccion.

## Rama staging: 
    - Es la rama previa a pasar a PRD.

    - Sobre esta rama se ejecutan los TESTs de CI

## Ramas Feature: 

    - cada vez que vayamos a programar una feature nueva, creamos una rama con la siguiente nomenclatura: feature/nombre_feature . 

    - Ejemplo: feature/login.

# Flujo de desarrollo
## 1. Nueva rama feature: 
Para iniciar el desarrollo de una nueva funcionalidad, vamos a crear una nueva rama, llamada **feature/funcionalidad** desde **staging**.
```bash
# 1. Crear tu rama individual desde staging
git checkout staging
git pull origin staging
git checkout -b feature/login-usuario
```

```bash
# 2. Hacer tus cambios y subirlos a GitHub
git add .
git commit -m "Agregado login de usuario"
git push origin feature/login-usuario
```


## 2. Pull Request a Staging:
Trabajamos en esa nueva funcionalidad. Cuando esta lista la *subimos a staging* mediante una **pull request**.
```bash
# 3. Ir a GitHub en el navegador:
# - Verás un botón para abrir un Pull Request hacia 'staging'.
# - El CI ejecutará las pruebas automáticamente.
# - Cuando esté en verde (✅), haces clic en "Merge Pull Request".

# 4. Borrar la rama local (opcional)
git checkout staging
git pull origin staging
git branch -d feature/login-usuario
```
Nota: esto mismo podria pasar con varias funcionalidades en paralelo. Es decir, en staging podemos acumular varias funcionalidades que aun no esten en main/produccion.

## 3. Release 🎯✨
Vamos a crear una nueva Pull Request desde staging a main: 

    - Nueva PR

    - base ⬅️ compare
        - base: main (es la rama destino, la que va a recibir el código).
        - compare: staging (es la rama origen, la que tiene los cambios nuevos).

    - GitHub te mostrará en verde que "Able to merge". Haz clic en Create pull request.

    - Ponle un título representativo, por ejemplo: **"Release: Login y Gestión de Usuarios"** o **"Actualización V1.2"**.

    - Haz clic de nuevo en **Create pull request**.


## 4. ¿Qué pasa en ese momento?

Tu Action (ci.yml) se ejecutará una última vez sobre este Pull Request para re-confirmar que las pruebas pasan en esta integración final.

Cuando el tilde verde ✅ aparezca, tú (o cualquier compañero) le dan al botón verde Merge pull request .

¡Y listo! En ese momento, la rama main absorbe todo lo que tenía staging.