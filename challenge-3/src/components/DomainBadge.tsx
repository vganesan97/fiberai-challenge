import React from 'react';
import { VStack, HStack, Badge } from '@chakra-ui/react';

interface DomainBadgeProps {
    isSmallScreen: boolean;
    availableDomains: number;
    unavailableDomains: number;
    maxDomains: number;
}

const DomainBadge: React.FC<DomainBadgeProps> = (props) => {

    const {
        isSmallScreen,
        availableDomains,
        unavailableDomains,
        maxDomains,
    } = props;

    const renderBadges = () => (
        <>
            {availableDomains > 0 && <Badge colorScheme="green">Available Domains: {availableDomains}</Badge>}
            {unavailableDomains > 0 && <Badge colorScheme="red">Unavailable Domains: {unavailableDomains}</Badge>}
            {availableDomains > maxDomains && <Badge colorScheme="yellow">Please remove extra domains</Badge>}
        </>
    );

    return (
        isSmallScreen ?
            <VStack spacing={4}>
                {renderBadges()}
            </VStack> :
            <HStack spacing={4} direction={{ base: "column", md: "row" }}>
                {renderBadges()}
            </HStack>
    );
};

export default DomainBadge;
