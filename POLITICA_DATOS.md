# POLITICA DE TRATAMIENTO DE DATOS PERSONALES

## Elector360 - Cumplimiento Ley 1581 de 2012

**Responsable del Tratamiento**: Arcenis Munoz
**Correo electronico**: arramumo@gmail.com
**Fecha de entrada en vigencia**: Febrero 2026

---

## 1. MARCO LEGAL

La presente politica se desarrolla en cumplimiento de:

- **Articulo 15 de la Constitucion Politica de Colombia**: Derecho a la intimidad y al habeas data.
- **Ley 1581 de 2012**: Disposiciones generales para la proteccion de datos personales.
- **Decreto 1377 de 2013**: Reglamentario parcial de la Ley 1581.
- **Decreto 1074 de 2015**: Decreto Unico Reglamentario del Sector Comercio, Industria y Turismo (Titulo 25 y 26).

---

## 2. DEFINICIONES

- **Dato personal**: Cualquier informacion vinculada o que pueda asociarse a una persona natural determinada o determinable.
- **Dato publico**: Dato que no es semiprivado, privado ni sensible (ej: datos contenidos en documentos publicos, registros publicos, gacetas y boletines oficiales).
- **Dato semiprivado**: Dato que no tiene naturaleza intima, reservada ni publica, y cuyo conocimiento interesa al titular y a un grupo limitado de personas.
- **Titular**: Persona natural cuyos datos personales son objeto de tratamiento.
- **Responsable del tratamiento**: Persona natural o juridica que decide sobre la base de datos y/o el tratamiento de los datos.
- **Encargado del tratamiento**: Persona natural o juridica que realiza el tratamiento de datos personales por cuenta del responsable.
- **Tratamiento**: Cualquier operacion sobre datos personales (recoleccion, almacenamiento, uso, circulacion, supresion).
- **Autorizacion**: Consentimiento previo, expreso e informado del titular para el tratamiento de sus datos personales.

---

## 3. DATOS PERSONALES RECOLECTADOS

El sistema Elector360 recolecta y trata los siguientes tipos de datos:

### 3.1 Datos de identificacion
- Numero de cedula de ciudadania (documento)
- Nombres y apellidos

### 3.2 Datos de contacto
- Numero de telefono celular
- Direccion de correo electronico

### 3.3 Datos electorales (obtenidos de fuentes publicas)
- Departamento de votacion
- Municipio de votacion
- Puesto de votacion (nombre y direccion)
- Mesa de votacion asignada

### 3.4 Datos del sistema
- Estado de contacto (Pendiente, Contactado, Confirmado, No Contactado)
- Estado de consulta RPA
- Fecha de creacion y actualizacion del registro
- Lider asignado

---

## 4. FINALIDAD DEL TRATAMIENTO

Los datos personales seran utilizados para las siguientes finalidades:

a) **Gestion electoral**: Organizacion, seguimiento y administracion de votantes asignados a lideres politicos.
b) **Consulta de informacion electoral**: Verificacion del puesto y mesa de votacion asignado a cada ciudadano mediante consulta a fuentes publicas (Registraduria Nacional del Estado Civil).
c) **Contacto**: Comunicacion con los titulares para informarles sobre su lugar de votacion y actividades relacionadas.
d) **Estadisticas**: Generacion de reportes y estadisticas agregadas para la planificacion electoral.
e) **Exportacion**: Generacion de reportes en formato Excel y CSV para uso interno autorizado.

---

## 5. NATURALEZA DE LOS DATOS

### 5.1 Datos publicos
Los datos electorales (puesto de votacion, mesa, departamento, municipio) se obtienen de consultas a la pagina web publica de la Registraduria Nacional del Estado Civil, y se consideran datos de naturaleza publica conforme al articulo 3 del Decreto 1377 de 2013.

### 5.2 Datos semiprivados
Los datos de identificacion (cedula, nombres, apellidos) y de contacto (telefono, email) se consideran datos semiprivados y requieren autorizacion del titular para su tratamiento, salvo las excepciones legales aplicables.

---

## 6. AUTORIZACION

### 6.1 Obtencion de la autorizacion
El Responsable del Tratamiento obtendra la autorizacion previa, expresa e informada del titular para el tratamiento de sus datos personales, la cual podra ser:

- Escrita (documento fisico o digital firmado)
- Verbal (con registro verificable)
- Mediante conductas inequivocas que permitan concluir que se otorgo la autorizacion

### 6.2 Excepciones
No se requerira autorizacion cuando se trate de:

- Datos de naturaleza publica
- Datos requeridos por una entidad publica en ejercicio de sus funciones
- Casos de urgencia medica o sanitaria
- Tratamiento autorizado por la ley para fines historicos, estadisticos o cientificos
- Datos relacionados con el Registro Civil de las Personas

---

## 7. DERECHOS DE LOS TITULARES

De conformidad con el articulo 8 de la Ley 1581 de 2012, los titulares tienen derecho a:

a) **Conocer**: Acceder de forma gratuita a sus datos personales que hayan sido objeto de tratamiento.
b) **Actualizar**: Solicitar la actualizacion de sus datos personales.
c) **Rectificar**: Solicitar la rectificacion de datos parciales, inexactos, incompletos, fraccionados o que induzcan a error.
d) **Solicitar supresion**: Pedir la eliminacion de sus datos cuando considere que no estan siendo tratados conforme a la ley.
e) **Revocar la autorizacion**: Revocar la autorizacion otorgada para el tratamiento de sus datos.
f) **Presentar quejas**: Ante la Superintendencia de Industria y Comercio por infracciones a la ley.

### 7.1 Procedimiento para ejercer derechos
Para ejercer cualquiera de los derechos mencionados, el titular podra comunicarse a:

- **Correo electronico**: arramumo@gmail.com
- **Asunto**: "Derechos ARCO - Elector360"

La solicitud debera contener:
- Nombre completo del titular
- Numero de cedula
- Descripcion de los hechos y derecho que desea ejercer
- Datos de contacto para respuesta

### 7.2 Plazos de respuesta
- **Consultas**: Maximo 10 dias habiles desde la recepcion de la solicitud.
- **Reclamos**: Maximo 15 dias habiles desde la recepcion. Si no es posible atenderlo en ese plazo, se informara al titular los motivos y la fecha estimada de respuesta (no mayor a 8 dias habiles adicionales).

---

## 8. MEDIDAS DE SEGURIDAD

El Responsable del Tratamiento implementa las siguientes medidas para proteger los datos personales:

### 8.1 Medidas tecnicas
- Autenticacion mediante JWT (JSON Web Tokens) con expiracion configurable
- Encriptacion de contrasenas con algoritmos seguros (bcrypt)
- Control de acceso basado en roles (ADMIN, LIDER)
- Rate limiting para prevenir abuso de la API
- HTTPS para comunicaciones en produccion
- Validacion de datos de entrada en backend y frontend

### 8.2 Medidas organizativas
- Acceso restringido: los LIDERES solo pueden ver y gestionar las personas asignadas a ellos
- Los ADMIN tienen acceso completo pero con registro de actividades
- Las contrasenas no se almacenan en texto plano
- Los archivos temporales (Excel cargados) se eliminan inmediatamente despues del procesamiento

### 8.3 Base de datos
- MongoDB con autenticacion habilitada
- Conexiones encriptadas (SSL/TLS)
- Indices optimizados para consultas eficientes

---

## 9. TRANSFERENCIA Y TRANSMISION DE DATOS

### 9.1 Transferencia internacional
Los datos personales pueden ser almacenados en servidores de MongoDB Atlas ubicados fuera de Colombia. En tal caso, se garantiza que el proveedor cumple con estandares de proteccion adecuados conforme al articulo 26 de la Ley 1581 de 2012.

### 9.2 Consulta a fuentes publicas
El sistema realiza consultas automatizadas a la pagina web publica de la Registraduria Nacional del Estado Civil para obtener informacion electoral. Esta informacion es de naturaleza publica.

---

## 10. CONSERVACION DE DATOS

Los datos personales seran conservados durante el tiempo que sea necesario para cumplir con las finalidades descritas en esta politica. Una vez cumplida la finalidad, los datos seran eliminados de la base de datos, salvo obligacion legal de conservacion.

El sistema permite:
- Eliminacion individual de registros de personas
- Limpieza automatica de la cola de consultas (registros antiguos)
- Eliminacion masiva de errores de consulta

---

## 11. TRATAMIENTO DE DATOS DE MENORES

El sistema Elector360 esta disenado exclusivamente para el tratamiento de datos de personas mayores de edad (con cedula de ciudadania). No se recolectan ni tratan datos de menores de edad.

---

## 12. MODIFICACIONES

El Responsable del Tratamiento se reserva el derecho de modificar esta politica en cualquier momento. Cualquier cambio sera informado a los usuarios del sistema y publicado en este documento.

---

## 13. CONTACTO Y CANAL DE ATENCION

Para cualquier consulta, reclamo o solicitud relacionada con el tratamiento de datos personales:

**Responsable**: Arcenis Munoz
**Correo**: arramumo@gmail.com
**Asunto sugerido**: "Proteccion de Datos - Elector360"

---

## 14. VIGENCIA

Esta politica entra en vigencia a partir de febrero de 2026 y estara vigente mientras se realice tratamiento de datos personales a traves del sistema Elector360.
