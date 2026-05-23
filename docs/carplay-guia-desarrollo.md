# Guía: App de Voz con CarPlay en iOS

## ¿Es posible un botón de voz con STT + TTS + IA en CarPlay?

**Sí es posible, pero con limitaciones importantes.**

---

## 1. UI en CarPlay — Solo plantillas predefinidas

Apple restringe la interfaz en CarPlay. No puedes poner cualquier UI — solo plantillas predefinidas:

- `CPListTemplate` — listas
- `CPGridTemplate` — cuadrícula de botones
- `CPNowPlayingTemplate` — estilo reproductor
- `CPAlertTemplate` — alertas
- **`CPVoiceControlTemplate`** ← **Este es el ideal para apps de voz**

`CPVoiceControlTemplate` está diseñado exactamente para apps de voz — muestra una animación de ondas mientras escucha.

---

## 2. Flujo de la app

```
Usuario abre app en CarPlay
        ↓
CPVoiceControlTemplate (botón / animación de voz)
        ↓
Usuario toca → AVAudioSession graba (STT)
        ↓
Audio → backend con IA (OpenAI, Whisper, etc.)
        ↓
Respuesta → TTS → AVAudioSession reproduce
        ↓
Vuelve a escuchar o termina
```

---

## 3. Configuración necesaria

### 3.1 AVAudioSession

```swift
try AVAudioSession.sharedInstance().setCategory(
    .playAndRecord,
    mode: .voiceChat, // o .measurement para STT
    options: [.allowBluetooth, .defaultToSpeaker]
)
```

### 3.2 Entitlement de CarPlay

Tu app entraría en la categoría **"Communication"** o **"General purpose audio"**. Debes solicitar a Apple el entitlement correspondiente — ellos aprueban caso por caso.

### 3.3 STT y TTS propios

No estás obligado a usar Siri. Puedes capturar el audio tú mismo con `AVAudioEngine` o `SFSpeechRecognizer` y mandarlo a tu propia IA.

---

## 4. Checklist de configuración en Xcode

### 4.1 Agregar la capability de CarPlay

```
Target → Signing & Capabilities → + Capability → CarPlay
```

### 4.2 Entitlement en el .entitlements file

```xml
<key>com.apple.developer.carplay-audio</key>
<true/>
```

> El key cambia según tu categoría: `carplay-audio`, `carplay-communication`, `carplay-navigation`, etc.

### 4.3 Implementar `CPTemplateApplicationSceneDelegate`

```swift
class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didConnect interfaceController: CPInterfaceController
    ) {
        // Aquí montas tu primer template
        let template = CPVoiceControlTemplate(voiceControlStates: [...])
        interfaceController.setRootTemplate(template, animated: false)
    }
}
```

### 4.4 Declarar en `Info.plist`

```xml
<key>UIApplicationSceneManifest</key>
<dict>
    <key>UISceneConfigurations</key>
    <dict>
        <key>CPTemplateApplicationSceneSessionRoleApplication</key>
        <array>
            <dict>
                <key>UISceneClassName</key>
                <string>CPTemplateApplicationScene</string>
                <key>UISceneDelegateClassName</key>
                <string>$(PRODUCT_MODULE_NAME).CarPlaySceneDelegate</string>
            </dict>
        </array>
    </dict>
</dict>
```

---

## 5. Probar en el simulador de CarPlay

1. Correr la app en el **iPhone Simulator** desde Xcode
2. Ir a **I/O → External Displays → CarPlay**
3. Se abre una ventana simulando la pantalla de CarPlay

> Si la app **no aparece** en el simulador, revisa que tengas todos los pasos del Checklist completos. El carro físico tiene los mismos requisitos — si no funciona en el simulador, tampoco funcionará en el carro.

---

## 6. Probar en un carro real

El carro físico **además** requiere:

1. **Solicitar el CarPlay entitlement** en el portal de Apple Developer
2. Agregar el entitlement a tu **App ID** en developer.apple.com
3. Actualizar tu **provisioning profile**
4. Conectar el iPhone al carro con cable USB (o wireless si el carro lo soporta)

---

## 7. ¿Necesitas suscripción de Apple Developer?

| Escenario | ¿Requiere pago? |
|---|---|
| Probar en simulador de CarPlay | ❌ Gratis |
| Probar en dispositivo / carro real | ✅ $99/año (Apple Developer Program) |
| Solicitar entitlement de CarPlay | ✅ Requiere membresía activa |
| Publicar en App Store | ✅ Requiere membresía activa |

### ¿Hay descuento para estudiantes?

No existe descuento directo para estudiantes individuales. Sin embargo:

- **Universidades acreditadas** pueden solicitar una exención de pago (*fee waiver*) y obtener la membresía gratis
- Pregunta en tu facultad de sistemas/ingeniería si tu universidad ya tiene una cuenta activa — muchas la tienen y los estudiantes no lo saben

---

## 8. Resumen de posibilidades

| Funcionalidad | ¿Posible? |
|---|---|
| Botón para hablar en CarPlay | ✅ Con `CPVoiceControlTemplate` |
| Grabar audio del usuario | ✅ Con `AVAudioEngine` |
| Enviar a IA propia (OpenAI, Whisper, etc.) | ✅ Llamada HTTP normal |
| Reproducir respuesta TTS | ✅ Con `AVSpeechSynthesizer` o audio de API |
| Aprobación de Apple garantizada | ⚠️ Depende del entitlement y revisión manual |

---

## 9. Ruta de desarrollo recomendada

```
1. Haz que funcione en el simulador de CarPlay (gratis)
2. Solicita el entitlement a Apple
3. Prueba en dispositivo físico conectado al carro
4. Publica en App Store
```

---

## 10. Restricción importante ⚠️

Apple revisa **manualmente** las apps de CarPlay. Si tu app no encaja claramente en una categoría aprobada, puede ser rechazada. Una app de asistente de voz genérico con IA es **territorio gris** — debes justificar bien el caso de uso al solicitar el entitlement.
