import React from 'react';
import { Alert, AlertIcon, StatGroup, Stat, StatLabel, StatNumber, StatHelpText, Text, Button, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, HStack } from '@chakra-ui/react';

interface DomainActionsProps {
    isSmallScreen: boolean;
    availableDomains: number;
    unavailableDomains: number;
    maxDomains: number;
    isPurchaseDisabled: boolean;
    isOpen: boolean;
    handlePurchase: () => void;
    setIsOpen: (isOpen: boolean) => void;
}

const DomainActions: React.FC<DomainActionsProps> = (props: DomainActionsProps) => {

    const {
        availableDomains,
        unavailableDomains,
        maxDomains,
        isPurchaseDisabled,
        isOpen,
        handlePurchase,
        setIsOpen,
    } = props;

    const renderAlerts = () => (
        <>
            {unavailableDomains === 0 && availableDomains === maxDomains && (
                <Alert status="success" variant="left-accent">
                    <AlertIcon />
                    <StatGroup>
                        <Stat>
                            <StatLabel>Added Available Domains</StatLabel>
                            <StatNumber>{availableDomains}</StatNumber>
                            <StatHelpText>{maxDomains} Max</StatHelpText>
                        </Stat>
                    </StatGroup>
                </Alert>
            )}
            {availableDomains >= 1 && availableDomains < maxDomains && (
                <Alert status="info" variant="left-accent">
                    <AlertIcon />
                    <StatGroup>
                        <Stat>
                            <StatLabel>Added Available Domains</StatLabel>
                            <StatNumber>{availableDomains}</StatNumber>
                            <StatHelpText>{maxDomains} Max</StatHelpText>
                        </Stat>
                    </StatGroup>
                </Alert>
            )}
            {availableDomains > maxDomains && (
                <Alert status="warning" variant="left-accent">
                    <AlertIcon />
                    <Text fontWeight="bold">Please remove {availableDomains - maxDomains} available {(availableDomains - maxDomains === 1) ? "domain" : "domains"} to match the limit.</Text>
                </Alert>
            )}
            {unavailableDomains > 0 && (
                <Alert status="warning" variant="left-accent">
                    <AlertIcon />
                    <Text fontWeight="bold">Please remove {unavailableDomains} unavailable {unavailableDomains === 1 ? "domain" : "domains"}.</Text>
                </Alert>
            )}
        </>
    );

    return (
        <HStack spacing={4} direction={{ base: "column", md: "row" }}>
            {renderAlerts()}

            {!isPurchaseDisabled && (
                <Button
                    size="lg"
                    colorScheme="teal"
                    variant="solid"
                    boxShadow="md"
                    _hover={{ boxShadow: "lg" }}
                    onClick={handlePurchase}
                >
                    Purchase
                </Button>
            )}

            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Purchase Successful</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        Congratulations! Your purchase was successful.
                    </ModalBody>
                    <ModalFooter>
                        <Button colorScheme="blue" mr={3} onClick={() => setIsOpen(false)}>
                            Close
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </HStack>
    );
};

export default DomainActions;
