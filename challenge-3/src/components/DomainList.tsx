import React from 'react';
import { Box, Avatar, Input, Badge, Tooltip, IconButton, Spinner } from '@chakra-ui/react';
import { FaCheck, FaExclamationTriangle, FaTrash } from 'react-icons/fa';
import { DomainInfo } from './challenge';

interface DomainListProps {
    filteredCart: DomainInfo[];
    handleDomainNameChange: (name: string, index: number) => void;
    removeDomainFromCart: (name: string) => void;
}

const DomainList: React.FC<DomainListProps> = (props: DomainListProps) => {

    const {
        filteredCart,
        handleDomainNameChange,
        removeDomainFromCart,
    } = props;

    return (
        <Box w="100%" maxW="md">
            {filteredCart.map((d, index) => (
                <Box key={index} display="flex" alignItems="center" p={4} border="1px" borderColor="gray.200" borderRadius="md">
                    <Avatar
                        size="sm"
                        icon={d.isLoading ? <Spinner /> : d.available ? <FaCheck /> : <FaExclamationTriangle />}
                        mr={4}
                    />
                    <Box w="200px">
                        <Input
                            value={d.name}
                            onChange={(e) => {
                                console.log(`Changing domain name at index ${index} to: ${e.target.value}`);
                                handleDomainNameChange(e.target.value, index);
                            }}
                        />
                    </Box>
                    <Box w="150px" textAlign="center">
                        {d.isLoading ? (
                            <Spinner size="sm" />
                        ) : (
                            <Badge colorScheme={d.available ? 'green' : 'red'}>
                                {d.available ? 'Available' : 'Unavailable'}
                            </Badge>
                        )}
                    </Box>
                    <Tooltip label="Remove" aria-label="A tooltip" ml={4}>
                        <IconButton
                            aria-label="Remove"
                            icon={<FaTrash />}
                            onClick={() => {
                                console.log(`Removing domain: ${d.name}`);
                                removeDomainFromCart(d.name);
                            }}
                        />
                    </Tooltip>
                </Box>
            ))}
        </Box>
    );
};

export default DomainList;
