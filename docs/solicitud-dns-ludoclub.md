# Solicitud de registros DNS para ludoclub.edu.co

Para enviar los certificados por correo desde la plataforma, hay que agregar unos
registros al dominio del colegio. **No se modifica ni se borra nada existente:**
el correo, la página web y todo lo que ya funciona siguen igual. Solo se agregan
renglones nuevos.

## Para quién es este mensaje

Para quien administre el dominio `ludoclub.edu.co`: puede ser la empresa donde se
compró (GoDaddy, Hostinger, Namecheap…), el hosting de la página web, o quien la
haya desarrollado.

## Qué hay que agregar

> Copiar estos valores EXACTAMENTE como los muestra el panel de Resend
> (Domains → ludoclub.edu.co). Reemplazar lo que está entre corchetes.

| Tipo | Nombre / Host | Valor | Prioridad |
|------|---------------|-------|-----------|
| MX   | `send` | `feedback-smtp.sa-east-1.amazonses.com` | 10 |
| TXT  | `send` | `v=spf1 include:amazonses.com ~all` | — |
| TXT  | `resend._domainkey` | `[clave larga que empieza por p=]` | — |
| TXT  | `_dmarc` | `v=DMARC1; p=none;` | — |

## Advertencias para quien los agregue

- **No borrar ni modificar ningún registro existente.** Solo agregar los nuevos.
- Si ya existe un registro `_dmarc`, no duplicarlo: avisar y lo revisamos.
- Algunos paneles completan el dominio solos. Si al guardar `send` queda como
  `send.ludoclub.edu.co.ludoclub.edu.co`, escribir únicamente `send`.
- Los registros se llaman `send` y `resend._domainkey`, es decir, van en un
  subdominio. El dominio principal no se toca.

## Qué pasa después

Los cambios tardan entre unos minutos y 48 horas en propagarse. Cuando estén
listos, avisar para confirmarlo desde el panel de Resend.

## Si no es posible

Existe una alternativa que no necesita tocar el DNS: enviar los certificados
desde la cuenta de Gmail del colegio. Los correos saldrían desde
`clubaventurascreativas@gmail.com` en vez de `certificados@ludoclub.edu.co`,
con un límite aproximado de 500 correos diarios. Es suficiente para los
certificados, solo menos formal.
