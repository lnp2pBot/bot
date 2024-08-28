export const removeLightningPrefix = (invoice: string): string => {
    const prefix = 'lightning:';

    // Check if the invoice starts with the prefix
    if (invoice.startsWith(prefix)) {
        return invoice.substring(prefix.length);
    }

    // Return the invoice as is if no prefix is found
    return invoice;
};
