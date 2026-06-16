import { cleanSttHallucinations } from './stt-transcript.util';

describe('cleanSttHallucinations', () => {
  it('removes repeated trailing gracias hallucinations', () => {
    const input = 'Hola buenas noches, ¿cómo estás?  ¡Gracias!  ¡Gracias!';
    expect(cleanSttHallucinations(input)).toBe('Hola buenas noches, ¿cómo estás?');
  });

  it('removes single trailing gracias when it is the only occurrence', () => {
    expect(cleanSttHallucinations('¿Quiénes son los demandantes? Gracias.'))
      .toBe('¿Quiénes son los demandantes?');
  });

  it('keeps gracias when it is part of the actual request', () => {
    const input = '¿Me puedes decir las pretensiones, gracias?';
    expect(cleanSttHallucinations(input)).toBe(input);
  });

  it('removes repeated thank you hallucinations', () => {
    expect(cleanSttHallucinations('What were the facts? Thank you. Thank you.'))
      .toBe('What were the facts?');
  });
});
