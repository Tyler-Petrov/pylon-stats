import { defineParams } from '@sveltejs/kit/params';

const digits = (param: string) => /^[1-9]\d*$/.test(param);

export const params = defineParams({
	/** An ESPN team or player id. Kept a string, which is how the remote functions take it. */
	id: (param) => (digits(param) ? param : undefined),
	/** A week or season type number. */
	int: (param) => (digits(param) ? Number(param) : undefined)
});
