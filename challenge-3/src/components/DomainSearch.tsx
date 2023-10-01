import React from 'react';
import { Heading, Divider, HStack, Input, Button } from '@chakra-ui/react';

interface DomainSearchProps {
    shouldRenderDivider: boolean;
    domainInput: string;
    setDomainInput: (value: string) => void;
    addDomainToCart: () => void;
    handleKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const DomainSearch: React.FC<DomainSearchProps> = (props: DomainSearchProps) => {

    const {
        shouldRenderDivider,
        domainInput,
        setDomainInput,
        addDomainToCart,
        handleKeyPress
    } = props;

    return (
        <>
            {!shouldRenderDivider ? (
                <Heading m={0} p={0}>
                    <span style={{ color: 'green' }}>Search </span>
                    <span style={{ color: 'black' }}>for </span>
                    <span style={{ color: 'green' }}>Domains </span>
                    <span style={{ color: 'black' }}>to </span>
                    <span style={{ color: 'green' }}>Buy!</span>
                </Heading>
            ) : (
                <Divider style={{ backgroundColor: 'black', height: '2px' }} />
            )}

            <HStack>
                <Input
                    placeholder="Enter a domain name"
                    value={domainInput}
                    onChange={(e) => {
                        console.log(`Changing domain input to: ${e.target.value}`);
                        setDomainInput(e.target.value);
                    }}
                    onKeyDown={handleKeyPress}
                />
                <Button w="170px" onClick={() => {
                    console.log("Adding domain to cart.");
                    addDomainToCart();
                }}>
                    Add to Cart
                </Button>
            </HStack>
        </>
    );
};

export default DomainSearch;
